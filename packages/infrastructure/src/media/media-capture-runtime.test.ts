// ─────────────────────────────────────────────────────────────────────────────
// Testes do MediaCaptureRuntime (CAT-02A) — prova captura, validação (allowlist,
// tamanho, magic bytes), sha256, deduplicação e a garantia de NUNCA lançar.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { MediaCaptureRuntime } from './media-capture-runtime.js';
import { InMemoryMediaStore } from './in-memory-media-store.js';
import type { FetchedMedia, MediaGatewayPort } from './media-gateway-port.js';

const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]; // %PDF-1.7
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];

function b64(bytes: readonly number[]): string {
  return Buffer.from(Uint8Array.from(bytes)).toString('base64');
}
function shaOf(bytes: readonly number[]): string {
  return createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
}

class FakeGateway implements MediaGatewayPort {
  constructor(private readonly result: FetchedMedia | null) {}
  fetch(): Promise<FetchedMedia | null> {
    return Promise.resolve(this.result);
  }
}
class ThrowingGateway implements MediaGatewayPort {
  fetch(): Promise<FetchedMedia | null> {
    return Promise.reject(new Error('gateway explodiu'));
  }
}

const pdf = (): FetchedMedia => ({ base64: b64(PDF_BYTES), mime: 'application/pdf', fileName: 'HISCON.pdf' });

describe('MediaCaptureRuntime (CAT-02A)', () => {
  it('PDF válido: baixa, valida, calcula sha256 e persiste o blob', async () => {
    const store = new InMemoryMediaStore();
    await new MediaCaptureRuntime({ gateway: new FakeGateway(pdf()), store }).capture({});
    const sha = shaOf(PDF_BYTES);
    expect(await store.has(sha)).toBe(true);
    expect(store.count()).toBe(1);
    expect(store.get(sha)).toMatchObject({ sha256: sha, mime: 'application/pdf', size: PDF_BYTES.length });
  });

  it('deduplicação: mesmo conteúdo 2× ⇒ um único blob', async () => {
    const store = new InMemoryMediaStore();
    const rt = new MediaCaptureRuntime({ gateway: new FakeGateway(pdf()), store });
    await rt.capture({});
    await rt.capture({});
    expect(store.count()).toBe(1);
  });

  it('MIME fora da allowlist ⇒ não armazena', async () => {
    const store = new InMemoryMediaStore();
    await new MediaCaptureRuntime({
      gateway: new FakeGateway({ base64: b64(PDF_BYTES), mime: 'application/zip', fileName: 'x.zip' }),
      store,
    }).capture({});
    expect(store.count()).toBe(0);
  });

  it('tamanho acima do limite ⇒ não armazena', async () => {
    const store = new InMemoryMediaStore();
    await new MediaCaptureRuntime({ gateway: new FakeGateway(pdf()), store, maxBytes: 4 }).capture({});
    expect(store.count()).toBe(0);
  });

  it('magic bytes não conferem (mime pdf, conteúdo png) ⇒ não armazena', async () => {
    const store = new InMemoryMediaStore();
    await new MediaCaptureRuntime({
      gateway: new FakeGateway({ base64: b64(PNG_BYTES), mime: 'application/pdf', fileName: 'fake.pdf' }),
      store,
    }).capture({});
    expect(store.count()).toBe(0);
  });

  it('gateway retorna null ⇒ não armazena e não lança', async () => {
    const store = new InMemoryMediaStore();
    await expect(new MediaCaptureRuntime({ gateway: new FakeGateway(null), store }).capture({})).resolves.toBeUndefined();
    expect(store.count()).toBe(0);
  });

  it('gateway lança ⇒ capture NÃO lança (best-effort) e não armazena', async () => {
    const store = new InMemoryMediaStore();
    await expect(new MediaCaptureRuntime({ gateway: new ThrowingGateway(), store }).capture({})).resolves.toBeUndefined();
    expect(store.count()).toBe(0);
  });

  it('PNG válido também é aceito', async () => {
    const store = new InMemoryMediaStore();
    await new MediaCaptureRuntime({
      gateway: new FakeGateway({ base64: b64(PNG_BYTES), mime: 'image/png', fileName: 'foto.png' }),
      store,
    }).capture({});
    expect(await store.has(shaOf(PNG_BYTES))).toBe(true);
  });
});
