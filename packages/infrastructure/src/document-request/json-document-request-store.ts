// ─────────────────────────────────────────────────────────────────────────────
// JSON DOCUMENT REQUEST STORE (15C-1 · Parte 2) — read model persistente sobre a
// porta JsonStore (PgJsonStore em produção, namespace 'document-requests';
// InMemoryJsonStore em teste). Datas são revividas do JSON e TODO estado lido é
// validado pelo aggregate (fromState — Correção 2): JSON corrompido ⇒ erro
// EXPLÍCITO, nunca um aggregate inválido em memória.
// ─────────────────────────────────────────────────────────────────────────────
import { DocumentRequestAggregate } from '@reconstrua/domain';
import type { DocumentRequestState } from '@reconstrua/domain';
import type { DocumentRequestStore } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';

const NAMESPACE = 'document-requests';
const ABERTOS = new Set(['PENDING', 'AWAITING_CONFIRMATION', 'REOPENED']);

function reviverData(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return new Date(NaN); // tipo inesperado ⇒ data inválida ⇒ a validação rejeita
}

/** Revive as datas serializadas e VALIDA via aggregate (erro explícito). */
function reviver(raw: unknown): DocumentRequestState {
  const r = raw as Record<string, unknown>;
  const state = {
    ...r,
    createdAt: reviverData(r['createdAt']) ?? new Date(NaN),
    updatedAt: reviverData(r['updatedAt']) ?? new Date(NaN),
    receivedAt: reviverData(r['receivedAt']),
    dueAt: reviverData(r['dueAt']),
    lastReminderAt: reviverData(r['lastReminderAt']),
    lastMessagedAt: reviverData(r['lastMessagedAt']),
    history: (Array.isArray(r['history']) ? r['history'] : []).map((h) => {
      const e = h as Record<string, unknown>;
      return { ...e, at: reviverData(e['at']) ?? new Date(NaN) };
    }),
  } as unknown as DocumentRequestState;
  const validado = DocumentRequestAggregate.fromState(state); // Correção 2
  if (validado.isErr()) throw validado.unwrapErr();
  return validado.unwrap().toState();
}

export class JsonDocumentRequestStore implements DocumentRequestStore {
  constructor(private readonly json: JsonStore) {}

  async salvar(state: DocumentRequestState): Promise<void> {
    await this.json.put(NAMESPACE, state.requestId, state);
  }

  async porId(requestId: string): Promise<DocumentRequestState | null> {
    const raw = await this.json.get(NAMESPACE, requestId);
    if (raw === null || raw === undefined) return null;
    return reviver(raw);
  }

  async doCaso(caseId: string): Promise<readonly DocumentRequestState[]> {
    return (await this.todos()).filter((s) => s.caseId === caseId);
  }

  async abertasDoCliente(clientId: string): Promise<readonly DocumentRequestState[]> {
    return (await this.todos()).filter((s) => s.clientId === clientId && ABERTOS.has(s.status));
  }

  async doAdvogado(lawyerId: string): Promise<readonly DocumentRequestState[]> {
    return (await this.todos())
      .filter((s) => s.lawyerId === lawyerId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async abertas(): Promise<readonly DocumentRequestState[]> {
    return (await this.todos()).filter((s) => ABERTOS.has(s.status));
  }

  private async todos(): Promise<readonly DocumentRequestState[]> {
    const raws = await this.json.list(NAMESPACE);
    return raws.map(reviver).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
