// ─────────────────────────────────────────────────────────────────────────────
// Testes do DocumentReaderService (CAT-03A) — documentId → texto bruto, cacheado
// por sha256. Prova: leitura+cache, dedup (cache-hit não chama a visão), sem
// vínculo/blob, mime não legível, tamanho excedido, visão null e nunca-lança.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import { InMemoryJsonStore } from '../production/json-store.js';
import { InMemoryMediaStore, JsonDocumentLinkStore } from '../media/index.js';
import { DocumentReaderService } from './document-reader-service.js';
import { JsonDocumentTextCache } from './document-text-cache.js';
import type { DocumentReaderPort, LeituraDeDocumento } from './document-reader-port.js';
import { MedidorDeCusto } from '../custos/medidor-de-custo.js';

class TestClock implements Clock {
  now(): Date {
    return new Date('2026-07-16T00:00:00.000Z');
  }
}
class FakeReader implements DocumentReaderPort {
  calls = 0;
  constructor(
    private readonly result: string | null,
    private readonly throws = false,
  ) {}
  read(): Promise<LeituraDeDocumento | null> {
    this.calls += 1;
    if (this.throws) return Promise.reject(new Error('vision boom'));
    if (this.result === null) return Promise.resolve(null);
    return Promise.resolve({ texto: this.result, tokensIn: 2000, tokensOut: 500 });
  }
}

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

interface Kit {
  readonly service: DocumentReaderService;
  readonly reader: FakeReader;
  readonly cache: JsonDocumentTextCache;
  readonly custo: MedidorDeCusto;
}
async function makeKit(opts: {
  readerText: string | null;
  mime?: string;
  size?: number;
  throws?: boolean;
  maxBytes?: number;
  withLink?: boolean;
  withBlob?: boolean;
}): Promise<Kit> {
  const json = new InMemoryJsonStore();
  const links = new JsonDocumentLinkStore(json);
  const store = new InMemoryMediaStore();
  const cache = new JsonDocumentTextCache(json);
  const reader = new FakeReader(opts.readerText, opts.throws ?? false);
  if (opts.withBlob !== false) {
    await store.put({
      sha256: 'S1',
      mime: opts.mime ?? 'application/pdf',
      size: opts.size ?? bytes.length,
      bytes,
    });
  }
  if (opts.withLink !== false) {
    await links.save({
      documentId: 'DOC-1',
      messageId: 'M1',
      sha256: 'S1',
      mime: 'application/pdf',
    });
  }
  const custo = new MedidorDeCusto({ json, clock: new TestClock() });
  const service = new DocumentReaderService({
    links,
    store,
    reader,
    cache,
    model: 'claude-sonnet-5',
    clock: new TestClock(),
    custo,
    ...(opts.maxBytes !== undefined ? { maxBytes: opts.maxBytes } : {}),
  });
  return { service, reader, cache, custo };
}

describe('DocumentReaderService (CAT-03A)', () => {
  it('lê via visão, cacheia por sha256 e retorna o texto', async () => {
    const { service, reader, cache } = await makeKit({ readerText: 'TEXTO BRUTO DO DOC' });
    const text = await service.readById('DOC-1');
    expect(text).toBe('TEXTO BRUTO DO DOC');
    expect(reader.calls).toBe(1);
    expect(await cache.get('S1')).toMatchObject({
      sha256: 'S1',
      text: 'TEXTO BRUTO DO DOC',
      model: 'claude-sonnet-5',
      chars: 18,
    });
  });

  it('dedup: cache-hit NÃO chama a visão', async () => {
    const { service, reader } = await makeKit({ readerText: 'ABC' });
    await service.readById('DOC-1'); // popula o cache
    const again = await service.readById('DOC-1');
    expect(again).toBe('ABC');
    expect(reader.calls).toBe(1); // segunda vez veio do cache
  });

  it('sem vínculo ⇒ null', async () => {
    const { service } = await makeKit({ readerText: 'X', withLink: false });
    expect(await service.readById('DOC-1')).toBeNull();
  });

  it('sem blob ⇒ null', async () => {
    const { service } = await makeKit({ readerText: 'X', withBlob: false });
    expect(await service.readById('DOC-1')).toBeNull();
  });

  it('mime não legível ⇒ null (sem chamar a visão)', async () => {
    const { service, reader } = await makeKit({ readerText: 'X', mime: 'application/zip' });
    expect(await service.readById('DOC-1')).toBeNull();
    expect(reader.calls).toBe(0);
  });

  it('tamanho acima do limite ⇒ null', async () => {
    const { service, reader } = await makeKit({ readerText: 'X', size: 999, maxBytes: 4 });
    expect(await service.readById('DOC-1')).toBeNull();
    expect(reader.calls).toBe(0);
  });

  it('visão retorna null ⇒ null e não cacheia', async () => {
    const { service, cache } = await makeKit({ readerText: null });
    expect(await service.readById('DOC-1')).toBeNull();
    expect(await cache.get('S1')).toBeNull();
  });

  it('visão lança ⇒ NÃO lança (retorna null)', async () => {
    const { service } = await makeKit({ readerText: null, throws: true });
    await expect(service.readById('DOC-1')).resolves.toBeNull();
  });

  it('Medidor de Custo: leitura registra gasto por documentId; cache-hit NÃO registra', async () => {
    const { service, custo } = await makeKit({ readerText: 'TEXTO' });
    await service.readById('DOC-1');
    await service.readById('DOC-1'); // cache-hit: sem nova chamada, sem novo custo
    const registros = await custo.listar();
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      contexto: 'leitura-documento',
      documentId: 'DOC-1',
      model: 'claude-sonnet-5',
      tokensIn: 2000,
      tokensOut: 500,
    });
    // claude-sonnet: 2000/1M×$3 + 500/1M×$15 = $0.0135
    expect(registros[0]?.custoUsd).toBeCloseTo(0.0135, 6);
  });
});
