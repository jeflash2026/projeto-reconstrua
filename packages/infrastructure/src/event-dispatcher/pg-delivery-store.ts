// ─────────────────────────────────────────────────────────────────────────────
// PgDeliveryStore — implementação de PRODUÇÃO do ledger de entregas sobre
// PostgreSQL (schema event_store, tabela deliveries). Reivindicação ordenada e
// concorrente por (stream × subscriber) via cabeça de fila (DISTINCT ON) + lock
// guardado (`locked_at IS NULL`), com o UPDATE serializando reivindicações
// concorrentes ao mesmo registro. Enqueue idempotente por `ON CONFLICT DO NOTHING`.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ClaimedDelivery,
  Delivery,
  DeliveryStatusCounts,
  DeliveryStore,
  StoredEvent,
} from '@reconstrua/application';
import type { SqlClient, SqlRow } from '../event-store/sql-client.js';
import { rowToStoredEvent } from '../event-store/event-row.js';
import { rowToDelivery } from './delivery-row.js';

export class PgDeliveryStore implements DeliveryStore {
  constructor(private readonly sql: SqlClient) {}

  async enqueue(event: StoredEvent, subscribers: readonly string[], now: Date): Promise<void> {
    if (subscribers.length === 0) return;
    await this.sql.transaction(async (tx) => {
      for (const subscriber of subscribers) {
        await tx.query(
          `INSERT INTO event_store.deliveries
             (event_id, subscriber, stream_type, stream_id, version, status, next_attempt_at, created_at)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6, $6)
           ON CONFLICT (event_id, subscriber) DO NOTHING`,
          [event.id, subscriber, event.streamType, event.streamId, event.version, now],
        );
      }
    });
  }

  async claimDue(limit: number, now: Date, workerId: string): Promise<readonly ClaimedDelivery[]> {
    // Cabeça = menor versão pendente por (stream, subscriber); reivindicável se devida e destravada.
    const claimed = await this.sql.query<SqlRow>(
      `WITH heads AS (
         SELECT DISTINCT ON (stream_type, stream_id, subscriber) id, next_attempt_at, locked_at
           FROM event_store.deliveries
          WHERE status = 'pending'
          ORDER BY stream_type, stream_id, subscriber, version
       ),
       claimable AS (
         SELECT h.id
           FROM heads h
          WHERE h.next_attempt_at <= $2 AND h.locked_at IS NULL
          LIMIT $1
       )
       UPDATE event_store.deliveries d
          SET locked_at = $2, locked_by = $3
         FROM claimable c
        WHERE d.id = c.id AND d.locked_at IS NULL
        RETURNING d.*`,
      [limit, now, workerId],
    );
    if (claimed.length === 0) return [];

    const eventIds = claimed.map((r) => String(r.event_id));
    const eventRows = await this.sql.query<SqlRow>(
      'SELECT * FROM event_store.events WHERE id = ANY($1::uuid[])',
      [eventIds],
    );
    const eventsById = new Map<string, StoredEvent>();
    for (const row of eventRows) {
      const e = rowToStoredEvent(row);
      eventsById.set(e.id, e);
    }

    const result: ClaimedDelivery[] = [];
    for (const row of claimed) {
      const delivery = rowToDelivery(row);
      const event = eventsById.get(delivery.eventId);
      if (event) result.push({ delivery, event });
    }
    return result;
  }

  async markDelivered(deliveryIds: readonly string[], _now: Date): Promise<void> {
    if (deliveryIds.length === 0) return;
    await this.sql.query(
      `UPDATE event_store.deliveries
          SET status = 'delivered', locked_at = NULL, locked_by = NULL
        WHERE id = ANY($1::uuid[])`,
      [deliveryIds],
    );
  }

  async reschedule(
    deliveryId: string,
    nextAttemptAt: Date,
    attempts: number,
    error: string,
  ): Promise<void> {
    await this.sql.query(
      `UPDATE event_store.deliveries
          SET attempts = $2, next_attempt_at = $3, last_error = $4, locked_at = NULL, locked_by = NULL
        WHERE id = $1`,
      [deliveryId, attempts, nextAttemptAt, error],
    );
  }

  async deadLetter(deliveryId: string, reason: string, attempts: number): Promise<void> {
    await this.sql.query(
      `UPDATE event_store.deliveries
          SET status = 'dead', attempts = $2, last_error = $3, locked_at = NULL, locked_by = NULL
        WHERE id = $1`,
      [deliveryId, attempts, reason],
    );
  }

  async releaseStale(olderThan: Date): Promise<number> {
    const rows = await this.sql.query<SqlRow>(
      `UPDATE event_store.deliveries
          SET locked_at = NULL, locked_by = NULL
        WHERE locked_at IS NOT NULL AND locked_at < $1
        RETURNING id`,
      [olderThan],
    );
    return rows.length;
  }

  async countByStatus(): Promise<DeliveryStatusCounts> {
    const rows = await this.sql.query<{ status: string; c: number }>(
      'SELECT status, COUNT(*)::int AS c FROM event_store.deliveries GROUP BY status',
    );
    const counts = { pending: 0, delivered: 0, dead: 0 };
    for (const row of rows) {
      if (row.status === 'pending' || row.status === 'delivered' || row.status === 'dead') {
        counts[row.status] = Number(row.c);
      }
    }
    return counts;
  }

  async listDeadLetters(limit: number): Promise<readonly Delivery[]> {
    const rows = await this.sql.query<SqlRow>(
      `SELECT * FROM event_store.deliveries WHERE status = 'dead' ORDER BY created_at ASC LIMIT $1`,
      [limit],
    );
    return rows.map(rowToDelivery);
  }

  async replay(deliveryId: string, now: Date): Promise<void> {
    await this.sql.query(
      `UPDATE event_store.deliveries
          SET status = 'pending', attempts = 0, next_attempt_at = $2, last_error = NULL,
              locked_at = NULL, locked_by = NULL
        WHERE id = $1 AND status = 'dead'`,
      [deliveryId, now],
    );
  }
}
