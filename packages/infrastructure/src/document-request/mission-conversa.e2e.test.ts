// ─────────────────────────────────────────────────────────────────────────────
// 15C-3 · E2E — Mission Runtime × Conversa. O ciclo decretado:
//   criar solicitação → Mission Snapshot atualizado → conversa recebe snapshot →
//   AHRI menciona o documento (missão operacional) → cliente envia documento →
//   subscriber associa → snapshot limpa → AHRI para de cobrar.
// + associação inteligente (única/IA/dúvida→confirmação) + disparo proativo.
// A conversa NUNCA toca banco: o contexto nasce do SNAPSHOT.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type {
  ConversationIntent,
  ConversationMemoryRuntime,
  MissionSnapshotPort,
  PendenciaDocumentalProvider,
  SessionRuntime,
  StoredEvent,
} from '@reconstrua/application';
import {
  ConversationContextRuntime,
  DocumentRequestRuntime,
  ObservabilityRuntime,
  PromptBuilderRuntime,
  emptySnapshot,
} from '@reconstrua/application';
import { InMemoryJsonStore } from '../production/json-store.js';
import { JsonDocumentRequestStore } from './json-document-request-store.js';
import { DocumentRequestsAwareSnapshotAdapter } from './document-requests-snapshot-adapter.js';
import { DocumentArrivalSubscriber, arquivoCasaCom } from './document-arrival-subscriber.js';
import { DocumentRequestComunicador } from './document-request-comunicador.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';
const CASO = 'M-CASO-1';
class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}

function harness() {
  const store = new JsonDocumentRequestStore(new InMemoryJsonStore());
  const runtime = new DocumentRequestRuntime(store);
  const inner: MissionSnapshotPort = {
    load: (chatId) => Promise.resolve({ ...emptySnapshot(chatId), caseExists: true }),
  };
  const snapshots = new DocumentRequestsAwareSnapshotAdapter(inner, store);
  // O provider da conversa lê EXCLUSIVAMENTE o snapshot (nunca o store).
  const pendencia: PendenciaDocumentalProvider = async (chatId) => {
    const dr = (await snapshots.load(chatId))?.documentRequests;
    if (!dr || dr.totalPendentes === 0 || dr.ultimaSolicitacao === null) return null;
    return {
      total: dr.totalPendentes,
      documentName: dr.ultimaSolicitacao.documentName,
      requestedBy: dr.ultimaSolicitacao.requestedBy,
      prioridade: dr.prioridadeMaisAlta ?? 'normal',
    };
  };
  const sessions = {
    getOrOpen: () =>
      Promise.resolve({ chatId: CHAT, turns: 3, lastInboundAt: null, lastOutboundAt: null }),
  } as unknown as SessionRuntime;
  const enviadas: string[] = [];
  const outbounds: string[] = [];
  const memory = {
    recent: () => Promise.resolve([]),
    recentOutboundTexts: () => Promise.resolve([]),
    recordOutbound: (_c: string, texto: string) => {
      outbounds.push(texto);
      return Promise.resolve();
    },
  } as unknown as ConversationMemoryRuntime;
  const gateway = {
    sendText: (_c: string, texto: string) => {
      enviadas.push(texto);
      return Promise.resolve({ providerMessageId: `wa-${String(enviadas.length)}`, sentAt: NOW });
    },
  };
  const contexto = new ConversationContextRuntime(
    sessions,
    memory,
    {},
    undefined,
    () => Promise.resolve('CLIENTE'),
    pendencia,
  );
  const builder = new PromptBuilderRuntime(8);
  const observability = new ObservabilityRuntime();
  const subscriber = new DocumentArrivalSubscriber({
    store,
    runtime,
    gateway: gateway as never,
    observability,
    clock: new TestClock(),
  });
  const comunicador = new DocumentRequestComunicador({
    gateway: gateway as never,
    memory,
    runtime,
    nomeDoCliente: () => Promise.resolve('Jessé'),
    observability,
    clock: new TestClock(),
  });
  return {
    store,
    runtime,
    snapshots,
    contexto,
    builder,
    subscriber,
    comunicador,
    enviadas,
    outbounds,
  };
}

const intent: ConversationIntent = {
  id: 'i1',
  chatId: CHAT,
  directive: 'speak',
  speechAct: 'explain',
  topic: 'acompanhamento',
  references: [],
  urgency: 'normal',
  operationalRuleRef: 'RO-X',
  fundamento: 'f',
  timingHintMs: null,
  formedAt: NOW,
};

function eventoDocumento(documentId: string, fileName: string): StoredEvent {
  return {
    id: 'e1',
    streamType: 'document',
    streamId: documentId,
    version: 1,
    eventType: 'document.recognized',
    isRelevant: true,
    payload: { missionId: CASO, contentReference: fileName, mimeType: 'application/pdf' },
    provenance: {
      factRef: null,
      actor: 'AHRI',
      decisionType: null,
      fundamento: null,
      operationalRuleRef: null,
    },
    previousHash: null,
    hash: 'h',
    occurredAt: NOW,
    recordedAt: NOW,
    globalSeq: 1,
  };
}

async function styleGuidance(h: ReturnType<typeof harness>): Promise<string> {
  const view = await h.contexto.build(CHAT, null, NOW);
  return h.builder.build(intent, view).styleGuidance;
}

const NOVA = {
  requestId: '00000000-0000-4000-8000-0000000000e1',
  caseId: CASO,
  clientId: CHAT,
  lawyerId: 'ADV-1',
  documentName: 'Procuração',
  requestedBy: 'Dr. João Silva',
  createdAt: NOW,
} as const;

describe('15C-3 · E2E — a AHRI lembra do que falta, e para quando chega', () => {
  it('o ciclo completo do decreto', async () => {
    const h = harness();

    // ANTES: nenhuma pendência ⇒ conversa sem missão operacional.
    expect(await styleGuidance(h)).not.toContain('MISSÃO OPERACIONAL');

    // 1) Advogado cria → snapshot atualizado.
    await h.runtime.criar({ ...NOVA, priority: 'alta' });
    const snap = await h.snapshots.load(CHAT);
    expect(snap?.documentRequests?.totalPendentes).toBe(1);

    // 2) Conversa recebe o snapshot → AHRI menciona o documento (gentilmente).
    const sg = await styleGuidance(h);
    expect(sg).toContain('MISSÃO OPERACIONAL — obter documento pendente');
    expect(sg).toContain('«Procuração»');
    expect(sg).toContain('Dr. João Silva');
    expect(sg).toContain('GENTILEZA');
    expect(sg).toContain('jamais interrompa o assunto'); // convive com a conversa

    // 3) Cliente envia o documento → subscriber associa (única pendência).
    await h.subscriber.handle(eventoDocumento('doc-777', 'procuracao-assinada.pdf'));
    expect((await h.store.porId(NOVA.requestId))?.status).toBe('RECEIVED');

    // 4) Snapshot limpa → AHRI para de cobrar. Nenhuma memória paralela.
    expect((await h.snapshots.load(CHAT))?.documentRequests).toBeUndefined();
    expect(await styleGuidance(h)).not.toContain('MISSÃO OPERACIONAL');
  });

  it('cancelamento também esvazia a missão operacional (Parte 4)', async () => {
    const h = harness();
    await h.runtime.criar(NOVA);
    expect(await styleGuidance(h)).toContain('Procuração');
    await h.runtime.cancelar(NOVA.requestId, 'não precisa mais', 'ADV-1', NOW);
    expect(await styleGuidance(h)).not.toContain('MISSÃO OPERACIONAL');
  });
});

describe('15C-3 · associação INTELIGENTE (Parte 2)', () => {
  it('várias pendências + arquivo que casa com UMA ⇒ associa por IA', async () => {
    const h = harness();
    await h.runtime.criar(NOVA);
    await h.runtime.criar({
      ...NOVA,
      requestId: '00000000-0000-4000-8000-0000000000e2',
      documentName: 'Extrato Bancário',
    });
    await h.subscriber.handle(eventoDocumento('doc-9', 'extrato-bancario-junho.pdf'));
    expect((await h.store.porId('00000000-0000-4000-8000-0000000000e2'))?.status).toBe('RECEIVED');
    expect((await h.store.porId(NOVA.requestId))?.status).toBe('PENDING'); // a outra segue
  });

  it('várias pendências + arquivo AMBÍGUO ⇒ AWAITING + pergunta ao cliente (received só depois)', async () => {
    const h = harness();
    await h.runtime.criar(NOVA);
    await h.runtime.criar({
      ...NOVA,
      requestId: '00000000-0000-4000-8000-0000000000e2',
      documentName: 'Extrato Bancário',
    });
    await h.subscriber.handle(eventoDocumento('doc-9', 'documento.pdf'));
    expect((await h.store.porId(NOVA.requestId))?.status).toBe('AWAITING_CONFIRMATION');
    expect((await h.store.porId('00000000-0000-4000-8000-0000000000e2'))?.status).toBe(
      'AWAITING_CONFIRMATION',
    );
    expect(h.enviadas.at(-1)).toContain('ele é **Procuração** ou **Extrato Bancário**?');
  });

  it('arquivoCasaCom: normaliza acentos e tokens', () => {
    expect(arquivoCasaCom('procuracao-assinada.pdf', 'Procuração')).toBe(true);
    expect(arquivoCasaCom('carta_concessao.pdf', 'Carta de Concessão')).toBe(true);
    expect(arquivoCasaCom('documento.pdf', 'Procuração')).toBe(false);
  });
});

describe('15C-3 · disparo PROATIVO (Parte 3)', () => {
  it('created → messaged → gateway; outbound gravado na memória da conversa', async () => {
    const h = harness();
    const criada = await h.runtime.criar(NOVA);
    const r = await h.comunicador.anunciar(criada.unwrap());
    expect(r.ok).toBe(true);
    expect(h.enviadas[0]).toContain('Olá, Jessé.');
    expect(h.enviadas[0]).toContain('Documento solicitado:\nProcuração');
    expect(h.outbounds[0]).toBe(h.enviadas[0]); // a conversa fica ciente
    expect((await h.store.porId(NOVA.requestId))?.lastMessagedAt).not.toBeNull(); // messaged registrado
  });
});
