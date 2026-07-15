// ─────────────────────────────────────────────────────────────────────────────
// Mapeia uma linha SQL da tabela event_store.events para um StoredEvent tipado.
// Compartilhado por PgEventStore e PgOutboxStore.
// ─────────────────────────────────────────────────────────────────────────────
import type { StoredEvent } from '@reconstrua/application';
import type { SqlRow } from './sql-client.js';

export function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date(NaN);
}

export function asStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function rowToStoredEvent(r: SqlRow): StoredEvent {
  return {
    id: String(r.id),
    streamType: String(r.stream_type),
    streamId: String(r.stream_id),
    version: Number(r.version),
    eventType: String(r.event_type),
    isRelevant: Boolean(r.is_relevant),
    payload: (r.payload ?? {}) as Readonly<Record<string, unknown>>,
    provenance: {
      factRef: asStringOrNull(r.fact_ref),
      actor: asStringOrNull(r.actor),
      decisionType: asStringOrNull(r.decision_type),
      fundamento: asStringOrNull(r.fundamento),
      operationalRuleRef: asStringOrNull(r.operational_rule_ref),
    },
    previousHash: asStringOrNull(r.previous_hash),
    hash: String(r.hash),
    occurredAt: asDate(r.occurred_at),
    recordedAt: asDate(r.recorded_at),
    globalSeq: Number(r.global_seq),
  };
}
