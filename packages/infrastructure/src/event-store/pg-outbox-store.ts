// ─────────────────────────────────────────────────────────────────────────────
// PgOutboxStore — implementação de PRODUÇÃO do OutboxStore. A outbox é uma fila de
// trabalho técnica (distinta do event store append-only): o drenador lê os eventos
// não publicados e, após despachá-los, marca-os. Entrega ao-menos-uma-vez.
// ─────────────────────────────────────────────────────────────────────────────
import type { OutboxStore, StoredEvent } from '@reconstrua/application';
import type { SqlClient, SqlRow } from './sql-client.js';
import { rowToStoredEvent } from './event-row.js';

export class PgOutboxStore implements OutboxStore {
  constructor(private readonly sql: SqlClient) {}

  async fetchUnpublished(limit: number): Promise<readonly StoredEvent[]> {
    const rows = await this.sql.query<SqlRow>(
      `SELECT e.*
         FROM event_store.outbox o
         JOIN event_store.events e ON e.id = o.event_id
        WHERE o.published_at IS NULL
        ORDER BY o.created_at ASC, e.global_seq ASC
        LIMIT $1`,
      [limit],
    );
    return rows.map(rowToStoredEvent);
  }

  async markPublished(eventIds: readonly string[]): Promise<void> {
    if (eventIds.length === 0) return;
    await this.sql.query(
      'UPDATE event_store.outbox SET published_at = now() WHERE event_id = ANY($1::uuid[]) AND published_at IS NULL',
      [eventIds],
    );
  }

  async recordFailure(eventIds: readonly string[]): Promise<void> {
    if (eventIds.length === 0) return;
    await this.sql.query(
      'UPDATE event_store.outbox SET attempts = attempts + 1 WHERE event_id = ANY($1::uuid[])',
      [eventIds],
    );
  }
}
