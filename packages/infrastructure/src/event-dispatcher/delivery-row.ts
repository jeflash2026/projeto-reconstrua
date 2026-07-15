// ─────────────────────────────────────────────────────────────────────────────
// Mapeia uma linha SQL de event_store.deliveries para um Delivery tipado.
// ─────────────────────────────────────────────────────────────────────────────
import type { Delivery, DeliveryStatus } from '@reconstrua/application';
import type { SqlRow } from '../event-store/sql-client.js';
import { asDate, asStringOrNull } from '../event-store/event-row.js';

export function rowToDelivery(r: SqlRow): Delivery {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    subscriber: String(r.subscriber),
    streamType: String(r.stream_type),
    streamId: String(r.stream_id),
    version: Number(r.version),
    status: String(r.status) as DeliveryStatus,
    attempts: Number(r.attempts),
    nextAttemptAt: asDate(r.next_attempt_at),
    lastError: asStringOrNull(r.last_error),
    createdAt: asDate(r.created_at),
    lockedAt: r.locked_at === null || r.locked_at === undefined ? null : asDate(r.locked_at),
    lockedBy: asStringOrNull(r.locked_by),
  };
}
