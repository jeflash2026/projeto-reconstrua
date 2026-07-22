// ─────────────────────────────────────────────────────────────────────────────
// 15C-4 · AUTONOMIA OPERACIONAL — Partes 1 a 4 do decreto:
//   Parte 1 — resolução da confirmação ("É a Procuração" / "É o Extrato" /
//             "não sei" ⇒ jamais adivinhar);
//   Parte 2 — SLA automático (reminderPolicy; nunca RECEIVED/CANCELLED; falha
//             de envio nunca duplica);
//   Parte 3 — entrega ao advogado (received → canal → WhatsApp; entregue/
//             falhou/sem-canal; dedup por evento);
//   Parte 4 — resiliência (WhatsApp/read-model fora ⇒ estado consistente,
//             nenhuma perda, nenhuma duplicação, nenhuma exceção ao domínio).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type { StoredEvent } from '@reconstrua/application';
import { DocumentRequestRuntime, ObservabilityRuntime } from '@reconstrua/application';
import { InMemoryJsonStore } from '../production/json-store.js';
import { JsonDocumentRequestStore } from './json-document-request-store.js';
import { DocumentArrivalSubscriber, NS_CONFIRMACOES } from './document-arrival-subscriber.js';
import { DocumentRequestAutonomia, identificarCandidata } from './autonomia.js';
import {
  JsonNotificationChannelStore,
  LawyerNotifierSubscriber,
  NS_ENTREGAS,
} from './lawyer-notifier.js';
import type { RegistroDeEntrega } from './lawyer-notifier.js';
import { ProductionIngress } from '../production/production-ingress.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';
const CASO = 'M-CASO-1';
const ADV = 'ADV-1';
const ADV_FONE = '5511988887777@s.whatsapp.net';
class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}

const R1 = '00000000-0000-4000-8000-0000000000a1'; // Procuração
const R2 = '00000000-0000-4000-8000-0000000000a2'; // Extrato Bancário

function horas(n: number): Date {
  return new Date(NOW.getTime() + n * 60 * 60 * 1000);
}

function harness(opts: { gatewayFalha?: boolean } = {}) {
  const json = new InMemoryJsonStore();
  const store = new JsonDocumentRequestStore(json);
  const runtime = new DocumentRequestRuntime(store);
  const enviadas: { para: string; texto: string }[] = [];
  const gateway = {
    sendText: (para: string, texto: string) => {
      if (opts.gatewayFalha) return Promise.reject(new Error('WhatsApp fora do ar'));
      enviadas.push({ para, texto });
      return Promise.resolve({ providerMessageId: `wa-${String(enviadas.length)}`, sentAt: NOW });
    },
  };
  const observability = new ObservabilityRuntime();
  const clock = new TestClock();
  const subscriber = new DocumentArrivalSubscriber({
    store,
    runtime,
    gateway: gateway as never,
    confirmacoes: json,
    observability,
    clock,
  });
  const autonomia = new DocumentRequestAutonomia({
    store,
    runtime,
    gateway: gateway as never,
    confirmacoes: json,
    nomeDoCliente: () => Promise.resolve('Jessé'),
    observability,
    clock,
  });
  const canais = new JsonNotificationChannelStore(json);
  const notifier = new LawyerNotifierSubscriber({
    store,
    canais,
    gateway: gateway as never,
    entregas: json,
    nomeDoCliente: () => Promise.resolve('Jessé'),
    observability,
    clock,
  });
  return { json, store, runtime, subscriber, autonomia, canais, notifier, enviadas, observability };
}

const BASE = {
  caseId: CASO,
  clientId: CHAT,
  lawyerId: ADV,
  requestedBy: 'Dr. João Silva',
  createdAt: NOW,
} as const;

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

function eventoReceived(requestId: string, version = 3): StoredEvent {
  return {
    id: `er-${requestId}`,
    streamType: 'document-request',
    streamId: requestId,
    version,
    eventType: 'document-request.received',
    isRelevant: true,
    payload: {},
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
    globalSeq: 2,
  };
}

/** Prepara o cenário da dúvida: 2 pendências + arquivo ambíguo ⇒ ambas AWAITING. */
async function cenarioDeDuvida(h: ReturnType<typeof harness>): Promise<void> {
  await h.runtime.criar({ ...BASE, requestId: R1, documentName: 'Procuração' });
  await h.runtime.criar({ ...BASE, requestId: R2, documentName: 'Extrato Bancário' });
  await h.subscriber.handle(eventoDocumento('doc-9', 'documento.pdf'));
  expect((await h.store.porId(R1))?.status).toBe('AWAITING_CONFIRMATION');
  expect((await h.store.porId(R2))?.status).toBe('AWAITING_CONFIRMATION');
}

describe('15C-4 · Parte 1 — resolução da confirmação', () => {
  it('"É a Procuração" ⇒ associa por confirmacao-cliente; a outra volta a PENDENTE; contexto apagado', async () => {
    const h = harness();
    await cenarioDeDuvida(h);
    await h.autonomia.aoReceberTexto(CHAT, 'É a Procuração', NOW);
    const proc = await h.store.porId(R1);
    expect(proc?.status).toBe('RECEIVED');
    expect(proc?.fulfilledBy).toBe('doc-9');
    expect(proc?.history.at(-1)?.nota).toContain('confirmacao-cliente'); // meio registrado na auditoria
    expect((await h.store.porId(R2))?.status).toBe('PENDING'); // continua sendo cobrada
    expect(await h.json.get(NS_CONFIRMACOES, CHAT)).toBeNull(); // contexto efêmero apagado
  });

  it('"É o Extrato" ⇒ associa a candidata CERTA (nunca a primeira)', async () => {
    const h = harness();
    await cenarioDeDuvida(h);
    await h.autonomia.aoReceberTexto(CHAT, 'é o extrato', NOW);
    expect((await h.store.porId(R2))?.status).toBe('RECEIVED');
    expect((await h.store.porId(R1))?.status).toBe('PENDING');
  });

  it('"não sei" ⇒ permanece AWAITING; contexto preservado; JAMAIS adivinhar', async () => {
    const h = harness();
    await cenarioDeDuvida(h);
    await h.autonomia.aoReceberTexto(CHAT, 'não sei', NOW);
    expect((await h.store.porId(R1))?.status).toBe('AWAITING_CONFIRMATION');
    expect((await h.store.porId(R2))?.status).toBe('AWAITING_CONFIRMATION');
    expect(await h.json.get(NS_CONFIRMACOES, CHAT)).not.toBeNull(); // pode responder depois
    // ... e quando finalmente responder, resolve:
    await h.autonomia.aoReceberTexto(CHAT, 'ah, é a procuracao mesmo', NOW);
    expect((await h.store.porId(R1))?.status).toBe('RECEIVED');
  });

  it('sem confirmação pendente ⇒ texto comum não toca nenhuma solicitação', async () => {
    const h = harness();
    await h.runtime.criar({ ...BASE, requestId: R1, documentName: 'Procuração' });
    await h.autonomia.aoReceberTexto(CHAT, 'é a procuração', NOW);
    expect((await h.store.porId(R1))?.status).toBe('PENDING'); // nada mudou
  });

  it('identificarCandidata: ambíguo (cita as duas) ⇒ null', () => {
    const a = { documentName: 'Procuração' } as never;
    const b = { documentName: 'Extrato Bancário' } as never;
    expect(identificarCandidata('mandei a procuração e o extrato', [a, b])).toBeNull();
    expect(identificarCandidata('sim', [a, b])).toBeNull();
    expect(identificarCandidata('a procuracao', [a, b])).not.toBeNull();
  });
});

describe('15C-4 · Parte 2 — SLA automático', () => {
  it('política 24h vencida ⇒ lembrete registrado (aggregate) + mensagem entregue', async () => {
    const h = harness();
    await h.runtime.criar({
      ...BASE,
      requestId: R1,
      documentName: 'Procuração',
      reminderPolicy: '24h',
    });
    await h.autonomia.varredura(horas(25));
    const s = await h.store.porId(R1);
    expect(s?.lastReminderAt).not.toBeNull();
    expect(h.enviadas).toHaveLength(1);
    expect(h.enviadas[0]?.para).toBe(CHAT);
    expect(h.enviadas[0]?.texto).toContain('Oi, Jessé!');
    expect(h.enviadas[0]?.texto).toContain('Procuração');
    // Mesmo instante de novo ⇒ NÃO duplica (lastReminderAt governa a cadência).
    await h.autonomia.varredura(horas(25));
    expect(h.enviadas).toHaveLength(1);
  });

  it('política ainda não vencida ⇒ silêncio', async () => {
    const h = harness();
    await h.runtime.criar({
      ...BASE,
      requestId: R1,
      documentName: 'Procuração',
      reminderPolicy: '24h',
    });
    await h.autonomia.varredura(horas(10));
    expect(h.enviadas).toHaveLength(0);
  });

  it("política 'nenhum' ⇒ nunca lembra", async () => {
    const h = harness();
    await h.runtime.criar({
      ...BASE,
      requestId: R1,
      documentName: 'Procuração',
      reminderPolicy: 'nenhum',
    });
    await h.autonomia.varredura(horas(24 * 30));
    expect(h.enviadas).toHaveLength(0);
  });

  it('RECEIVED e CANCELLED jamais recebem lembrete', async () => {
    const h = harness();
    await h.runtime.criar({
      ...BASE,
      requestId: R1,
      documentName: 'Procuração',
      reminderPolicy: '24h',
    });
    await h.runtime.criar({
      ...BASE,
      requestId: R2,
      documentName: 'Extrato Bancário',
      reminderPolicy: '24h',
    });
    await h.runtime.associar(R1, 'doc-1', 'unica', NOW);
    await h.runtime.cancelar(R2, 'não precisa mais', ADV, NOW);
    await h.autonomia.varredura(horas(25));
    expect(h.enviadas).toHaveLength(0);
  });

  it('lembretes SUCESSIVOS respeitam a cadência (25h envia; 26h não; 50h envia de novo)', async () => {
    const h = harness();
    await h.runtime.criar({
      ...BASE,
      requestId: R1,
      documentName: 'Procuração',
      reminderPolicy: '24h',
    });
    await h.autonomia.varredura(horas(25));
    await h.autonomia.varredura(horas(26));
    expect(h.enviadas).toHaveLength(1);
    await h.autonomia.varredura(horas(50));
    expect(h.enviadas).toHaveLength(2);
  });
});

describe('15C-4 · Parte 3 — entrega ao advogado', () => {
  it('received + canal preferido ⇒ WhatsApp ao advogado + registro "entregue"', async () => {
    const h = harness();
    await h.canais.definir(ADV, [
      { tipo: 'whatsapp', endereco: ADV_FONE, preferido: true, verificadoEm: NOW.toISOString() },
    ]);
    await h.runtime.criar({ ...BASE, requestId: R1, documentName: 'Procuração' });
    await h.runtime.associar(R1, 'doc-1', 'unica', NOW);
    await h.notifier.handle(eventoReceived(R1));
    expect(h.enviadas).toHaveLength(1);
    expect(h.enviadas[0]?.para).toBe(ADV_FONE);
    expect(h.enviadas[0]?.texto).toContain(
      'O cliente Jessé acabou de enviar o documento solicitado',
    );
    expect(h.enviadas[0]?.texto).toContain('Procuração');
    const reg = (await h.json.get(NS_ENTREGAS, `${R1}:v3`)) as RegistroDeEntrega;
    expect(reg.resultado).toBe('entregue');
  });

  it('reentrega do MESMO evento ⇒ dedup (nenhuma segunda mensagem)', async () => {
    const h = harness();
    await h.canais.definir(ADV, [
      { tipo: 'whatsapp', endereco: ADV_FONE, preferido: true, verificadoEm: null },
    ]);
    await h.runtime.criar({ ...BASE, requestId: R1, documentName: 'Procuração' });
    await h.runtime.associar(R1, 'doc-1', 'unica', NOW);
    await h.notifier.handle(eventoReceived(R1));
    await h.notifier.handle(eventoReceived(R1)); // redelivery do dispatcher
    expect(h.enviadas).toHaveLength(1);
  });

  it('sem canal cadastrado ⇒ registro "sem-canal"; nada quebra', async () => {
    const h = harness();
    await h.runtime.criar({ ...BASE, requestId: R1, documentName: 'Procuração' });
    await h.runtime.associar(R1, 'doc-1', 'unica', NOW);
    await h.notifier.handle(eventoReceived(R1));
    expect(h.enviadas).toHaveLength(0);
    const reg = (await h.json.get(NS_ENTREGAS, `${R1}:v3`)) as RegistroDeEntrega;
    expect(reg.resultado).toBe('sem-canal');
  });

  it('WhatsApp falha ⇒ registro "falhou" com erro; NENHUMA exceção escapa', async () => {
    const h = harness({ gatewayFalha: true });
    await h.canais.definir(ADV, [
      { tipo: 'whatsapp', endereco: ADV_FONE, preferido: true, verificadoEm: null },
    ]);
    await h.runtime.criar({ ...BASE, requestId: R1, documentName: 'Procuração' });
    await h.runtime.associar(R1, 'doc-1', 'unica', NOW);
    await expect(h.notifier.handle(eventoReceived(R1))).resolves.toBeUndefined();
    const reg = (await h.json.get(NS_ENTREGAS, `${R1}:v3`)) as RegistroDeEntrega;
    expect(reg.resultado).toBe('falhou');
    expect(reg.erro).toContain('WhatsApp fora do ar');
  });
});

describe('15C-4 · Parte 4 — resiliência', () => {
  it('WhatsApp fora na varredura ⇒ lembrete FICA registrado; volta do gateway não duplica', async () => {
    const h = harness({ gatewayFalha: true });
    await h.runtime.criar({
      ...BASE,
      requestId: R1,
      documentName: 'Procuração',
      reminderPolicy: '24h',
    });
    await expect(h.autonomia.varredura(horas(25))).resolves.toBeUndefined();
    expect((await h.store.porId(R1))?.lastReminderAt).not.toBeNull(); // registrado ANTES do envio
    expect(h.enviadas).toHaveLength(0);
    // Gateway volta no MESMO ciclo ⇒ cadência já consumida: sem duplicação.
    const h2 = { ...h };
    await h2.autonomia.varredura(horas(25));
    expect(h.enviadas).toHaveLength(0);
  });

  it('read model fora ⇒ varredura registra e retorna; nenhuma exceção', async () => {
    const h = harness();
    const quebrado = new DocumentRequestAutonomia({
      store: { abertas: () => Promise.reject(new Error('pg down')) } as never,
      runtime: h.runtime,
      gateway: null,
      confirmacoes: h.json,
      nomeDoCliente: null,
      observability: h.observability,
      clock: new TestClock(),
    });
    await expect(quebrado.varredura(NOW)).resolves.toBeUndefined();
  });

  it('read model fora na confirmação ⇒ estado intacto; cliente pode reconfirmar depois', async () => {
    const h = harness();
    await cenarioDeDuvida(h);
    const quebrado = new DocumentRequestAutonomia({
      store: { abertasDoCliente: () => Promise.reject(new Error('pg down')) } as never,
      runtime: h.runtime,
      gateway: null,
      confirmacoes: h.json,
      nomeDoCliente: null,
      observability: h.observability,
      clock: new TestClock(),
    });
    await expect(quebrado.aoReceberTexto(CHAT, 'é a procuração', NOW)).resolves.toBeUndefined();
    expect((await h.store.porId(R1))?.status).toBe('AWAITING_CONFIRMATION'); // nada perdido
    expect(await h.json.get(NS_CONFIRMACOES, CHAT)).not.toBeNull(); // contexto preservado
    await h.autonomia.aoReceberTexto(CHAT, 'é a procuração', NOW); // read model voltou
    expect((await h.store.porId(R1))?.status).toBe('RECEIVED');
  });

  it('ingress: autonomia roda ANTES do turno na MESMA fila; falha dela nunca derruba a conversa', async () => {
    const ordem: string[] = [];
    const conversation = {
      receive: () => {
        ordem.push('turno');
        return Promise.resolve({ outcome: 'ok' } as never);
      },
      onTemporalTrigger: () => Promise.resolve({ outcome: 'ok' } as never),
    };
    const scheduler = { fireDue: () => Promise.resolve([]) };
    const autonomia = {
      aoReceberTexto: () => {
        ordem.push('autonomia');
        return Promise.reject(new Error('boom'));
      },
      varredura: () => {
        ordem.push('varredura');
        return Promise.resolve();
      },
    };
    const ingress = new ProductionIngress(
      conversation as never,
      scheduler as never,
      () => null,
      undefined,
      autonomia,
    );
    const envelope = {
      messageId: 'm1',
      chatId: CHAT,
      from: CHAT,
      kind: 'text' as const,
      text: 'é a procuração',
      mediaUrl: null,
      mediaMimeType: null,
      fileName: null,
      location: null,
      contact: null,
      reactionEmoji: null,
      reactionToMessageId: null,
      editedText: null,
      deletedMessageId: null,
      silenceMs: 0,
      timestamp: NOW,
    };
    await expect(ingress.receive(envelope)).resolves.toEqual({ outcome: 'ok' }); // falha da autonomia isolada
    await ingress.tick(NOW); // varredura no MESMO motor temporal
    expect(ordem).toEqual(['autonomia', 'turno', 'varredura']);
  });
});
