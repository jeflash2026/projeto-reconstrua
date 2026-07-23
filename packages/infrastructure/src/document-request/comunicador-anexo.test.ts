// ─────────────────────────────────────────────────────────────────────────────
// Decreto Tráfego Pago · B1 — anexo para ASSINATURA: quando o advogado anexa a
// procuração/contrato de honorários, o anúncio vira "para assinar" e o ARQUIVO
// segue junto pelo WhatsApp. Sem anexo ⇒ fluxo 15C intacto.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type { AnexoParaAssinatura } from '@reconstrua/application';
import { DocumentRequestRuntime, ObservabilityRuntime } from '@reconstrua/application';
import { InMemoryJsonStore } from '../production/json-store.js';
import { JsonDocumentRequestStore } from './json-document-request-store.js';
import { JsonAnexoStore } from './json-anexo-store.js';
import { DocumentRequestComunicador } from './document-request-comunicador.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';
class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}

const NOVA = {
  requestId: '00000000-0000-4000-8000-0000000000b1',
  caseId: 'M-1',
  clientId: CHAT,
  lawyerId: 'ADV-1',
  documentName: 'Procuração',
  requestedBy: 'Dr. João Silva',
  createdAt: NOW,
} as const;

function harness(opts: { comAnexo?: boolean; semEnviador?: boolean } = {}) {
  const json = new InMemoryJsonStore();
  const store = new JsonDocumentRequestStore(json);
  const runtime = new DocumentRequestRuntime(store);
  const anexos = new JsonAnexoStore(json);
  const textos: string[] = [];
  const arquivos: { chatId: string; anexo: AnexoParaAssinatura; caption: string }[] = [];
  const comunicador = new DocumentRequestComunicador({
    gateway: {
      sendText: (_c: string, t: string) => {
        textos.push(t);
        return Promise.resolve({ providerMessageId: 'wa-1', sentAt: NOW });
      },
    } as never,
    memory: { recordOutbound: () => Promise.resolve() } as never,
    runtime,
    nomeDoCliente: () => Promise.resolve('Isabel'),
    observability: new ObservabilityRuntime(),
    clock: new TestClock(),
    anexos,
    documentos: opts.semEnviador
      ? null
      : {
          sendDocument: (chatId, anexo, caption) => {
            arquivos.push({ chatId, anexo, caption });
            return Promise.resolve();
          },
        },
  });
  return { runtime, anexos, comunicador, textos, arquivos, store };
}

describe('B1 · anúncio com ANEXO do advogado', () => {
  it('anexo presente ⇒ mensagem de ASSINATURA + arquivo enviado ao cliente', async () => {
    const h = harness();
    const criada = (await h.runtime.criar(NOVA)).unwrap();
    await h.anexos.salvar(criada.requestId, {
      fileName: 'procuracao.pdf',
      mimeType: 'application/pdf',
      base64: 'QUJD',
    });
    const r = await h.comunicador.anunciar(criada);
    expect(r.ok).toBe(true);
    expect(h.textos[0]).toContain('precisa coletar a sua assinatura no documento a seguir');
    expect(h.textos[0]).toContain('Procuração');
    expect(h.textos[0]).toContain('assinar e devolver');
    expect(h.arquivos).toHaveLength(1);
    expect(h.arquivos[0]?.chatId).toBe(CHAT);
    expect(h.arquivos[0]?.anexo.fileName).toBe('procuracao.pdf');
    expect(h.arquivos[0]?.caption).toBe('Procuração');
    expect((await h.store.porId(criada.requestId))?.lastMessagedAt).not.toBeNull(); // messaged registrado
  });

  it('SEM anexo ⇒ fluxo 15C intacto (pedido normal, nenhum arquivo)', async () => {
    const h = harness();
    const criada = (await h.runtime.criar(NOVA)).unwrap();
    const r = await h.comunicador.anunciar(criada);
    expect(r.ok).toBe(true);
    expect(h.textos[0]).toContain('precisa do seguinte documento:');
    expect(h.arquivos).toHaveLength(0);
  });

  it('anexo presente mas gateway SEM envio de documento ⇒ mensagem vai, falha observada, nada lança', async () => {
    const h = harness({ semEnviador: true });
    const criada = (await h.runtime.criar(NOVA)).unwrap();
    await h.anexos.salvar(criada.requestId, {
      fileName: 'p.pdf',
      mimeType: 'application/pdf',
      base64: 'QUJD',
    });
    const r = await h.comunicador.anunciar(criada);
    expect(r.ok).toBe(true);
    expect(h.textos[0]).toContain('assinatura');
  });

  it('JsonAnexoStore: roundtrip e ausência', async () => {
    const h = harness();
    expect(await h.anexos.porRequest('inexistente')).toBeNull();
    await h.anexos.salvar('r1', { fileName: 'c.pdf', mimeType: 'application/pdf', base64: 'WFla' });
    const lido = await h.anexos.porRequest('r1');
    expect(lido?.fileName).toBe('c.pdf');
    expect(lido?.base64).toBe('WFla');
  });
});
