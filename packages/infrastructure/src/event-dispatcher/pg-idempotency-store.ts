// ─────────────────────────────────────────────────────────────────────────────
// PgIdempotencyStore — implementação de PRODUÇÃO da camada de idempotência sobre
// PostgreSQL (tabela event_store.idempotency, PK (subscriber, event_id)).
// ─────────────────────────────────────────────────────────────────────────────
import type { IdempotencyStore } from '@reconstrua/application';
import type { SqlClient, SqlRow } from '../event-store/sql-client.js';

export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly sql: SqlClient) {}

  async wasProcessed(subscriber: string, eventId: string): Promise<boolean> {
    const rows = await this.sql.query<SqlRow>(
      'SELECT 1 AS ok FROM event_store.idempotency WHERE subscriber = $1 AND event_id = $2 LIMIT 1',
      [subscriber, eventId],
    );
    return rows.length > 0;
  }

  async recordProcessed(subscriber: string, eventId: string, now: Date): Promise<void> {
    await this.sql.query(
      `INSERT INTO event_store.idempotency (subscriber, event_id, processed_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (subscriber, event_id) DO NOTHING`,
      [subscriber, eventId, now],
    );
  }
}
