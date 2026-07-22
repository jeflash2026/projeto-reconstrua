// ─────────────────────────────────────────────────────────────────────────────
// 15C-1 · Parte 2 — integração: read model persistente (round-trip JSON REAL,
// como o Pg devolve: datas viram strings e são revividas + validadas), runtime
// de casos de uso publicando eventos, e a projeção do resumo no MissionSnapshot
// (Decisão B). JSON corrompido ⇒ erro explícito (Correção 2).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { DocumentRequestState, DomainEvent } from '@reconstrua/domain';
import type { MissionSnapshot, MissionSnapshotPort } from '@reconstrua/application';
import { DocumentRequestRuntime, emptySnapshot } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';
import { JsonDocumentRequestStore } from './json-document-request-store.js';
import { DocumentRequestsAwareSnapshotAdapter } from './document-requests-snapshot-adapter.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
const T1 = new Date('2026-07-20T11:00:00.000Z');
const REQ = '00000000-0000-4000-8000-0000000000aa';

/** JsonStore que serializa DE VERDADE (fiel ao Pg: datas viram strings). */
class JsonRoundTripStore implements JsonStore {
  private readonly m = new Map<string, string>();
  get(ns: string, k: string): Promise<unknown> {
    const v = this.m.get(`${ns}:${k}`);
    return Promise.resolve(v === undefined ? null : JSON.parse(v));
  }
  put(ns: string, k: string, value: unknown): Promise<void> {
    this.m.set(`${ns}:${k}`, JSON.stringify(value));
    return Promise.resolve();
  }
  del(ns: string, k: string): Promise<void> {
    this.m.delete(`${ns}:${k}`);
    return Promise.resolve();
  }
  list(ns: string): Promise<readonly unknown[]> {
    return Promise.resolve(
      [...this.m.entries()]
        .filter(([key]) => key.startsWith(`${ns}:`))
        .map(([, v]) => JSON.parse(v) as unknown),
    );
  }
  keys(ns: string): Promise<readonly string[]> {
    return Promise.resolve(
      [...this.m.keys()].filter((k) => k.startsWith(`${ns}:`)).map((k) => k.slice(ns.length + 1)),
    );
  }
  /** Corrompe um registro (teste da Correção 2). */
  corromper(ns: string, k: string, patch: Record<string, unknown>): void {
    const atual = JSON.parse(this.m.get(`${ns}:${k}`) ?? '{}') as Record<string, unknown>;
    this.m.set(`${ns}:${k}`, JSON.stringify({ ...atual, ...patch }));
  }
}

function harness() {
  const json = new JsonRoundTripStore();
  const store = new JsonDocumentRequestStore(json);
  const publicados: Array<{ requestId: string; nomes: string[] }> = [];
  const runtime = new DocumentRequestRuntime(store, {
    publicar: (requestId: string, events: readonly DomainEvent[], _e: DocumentRequestState) => {
      publicados.push({ requestId, nomes: events.map((ev) => ev.eventName) });
      return Promise.resolve();
    },
  });
  return { json, store, runtime, publicados };
}

const NOVA = {
  requestId: REQ,
  caseId: 'CASE-1',
  clientId: '5511999@c',
  lawyerId: 'ADV-1',
  documentName: 'Procuração',
  requestedBy: 'Dr. João Silva',
  createdAt: NOW,
} as const;

describe('15C-1 · read model persistente (round-trip JSON fiel ao Pg)', () => {
  it('ciclo completo pelo runtime: criar → mensagear → associar; datas revividas; eventos publicados', async () => {
    const { store, runtime, publicados } = harness();

    expect((await runtime.criar({ ...NOVA, priority: 'alta', reminderPolicy: '48h' })).isOk()).toBe(
      true,
    );
    expect((await runtime.registrarMensagem(REQ, NOW)).isOk()).toBe(true);
    const assoc = await runtime.associar(REQ, 'doc-777', 'unica', T1);
    expect(assoc.isOk()).toBe(true);

    // Round-trip: datas voltam como Date reais e o estado é o esperado.
    const lido = await store.porId(REQ);
    expect(lido?.status).toBe('RECEIVED');
    expect(lido?.fulfilledBy).toBe('doc-777');
    expect(lido?.receivedAt).toEqual(T1);
    expect(lido?.createdAt).toEqual(NOW);
    expect(lido?.history.at(-1)?.at).toEqual(T1);

    // Eventos do ciclo publicados na ordem (created → messaged → received).
    expect(publicados.flatMap((p) => p.nomes)).toEqual([
      'document-request.created',
      'document-request.messaged',
      'document-request.received',
    ]);
  });

  it('Correção 2 na leitura: JSON corrompido ⇒ ERRO explícito, nunca estado inválido', async () => {
    const { json, store, runtime } = harness();
    await runtime.criar(NOVA);
    json.corromper('document-requests', REQ, { caseId: '' });
    await expect(store.porId(REQ)).rejects.toThrow('caseId obrigatório');
    json.corromper('document-requests', REQ, { caseId: 'CASE-1', status: 'INVENTADO' });
    await expect(store.porId(REQ)).rejects.toThrow('status desconhecido');
  });

  it('duplicidade de mensagem e transições inválidas retornam erro pelo runtime', async () => {
    const { runtime } = harness();
    await runtime.criar(NOVA);
    await runtime.registrarMensagem(REQ, NOW);
    expect((await runtime.registrarMensagem(REQ, T1)).isErr()).toBe(true); // Correção 1
    await runtime.associar(REQ, 'doc-1', 'unica', T1);
    expect((await runtime.associar(REQ, 'doc-2', 'unica', T1)).isErr()).toBe(true);
    // Reabrir permite mensagear de novo (nova abertura).
    expect((await runtime.reabrir(REQ, 'documento incorreto', 'ADV-1', T1)).isOk()).toBe(true);
    expect((await runtime.registrarMensagem(REQ, T1)).isOk()).toBe(true);
  });
});

describe('15C-1 · projeção no MissionSnapshot (Decisão B)', () => {
  const inner: MissionSnapshotPort = {
    load: (chatId: string) =>
      Promise.resolve({ ...emptySnapshot(chatId), caseExists: true } as MissionSnapshot),
  };

  it('com pendências ⇒ snapshot ganha documentRequests; sem ⇒ snapshot intacto', async () => {
    const { store, runtime } = harness();
    const adapter = new DocumentRequestsAwareSnapshotAdapter(inner, store);

    expect((await adapter.load('5511999@c'))?.documentRequests).toBeUndefined(); // nada ainda

    await runtime.criar({ ...NOVA, priority: 'alta' });
    const snap = await adapter.load('5511999@c');
    expect(snap?.documentRequests).toMatchObject({
      totalPendentes: 1,
      prioridadeMaisAlta: 'alta',
      aguardandoConfirmacao: 0,
    });
    expect(snap?.documentRequests?.ultimaSolicitacao?.documentName).toBe('Procuração');
    expect(snap?.caseExists).toBe(true); // base preservada

    await runtime.cancelar(REQ, 'não precisa mais', 'ADV-1', T1);
    expect((await adapter.load('5511999@c'))?.documentRequests).toBeUndefined(); // esvaziou
  });

  it('falha do read model ⇒ best-effort (snapshot base intacto, nunca quebra o Brain)', async () => {
    const quebrado = {
      abertasDoCliente: () => Promise.reject(new Error('down')),
    } as unknown as JsonDocumentRequestStore;
    const adapter = new DocumentRequestsAwareSnapshotAdapter(inner, quebrado);
    const snap = await adapter.load('x@c');
    expect(snap?.caseExists).toBe(true);
    expect(snap?.documentRequests).toBeUndefined();
  });
});
