// ─────────────────────────────────────────────────────────────────────────────
// PgSnapshotStore — implementação de PRODUÇÃO do SnapshotStore. Insert-only
// (mantém histórico de snapshots; nunca substitui eventos — Lei 3). Leitura do
// snapshot mais recente por stream. Otimização de reidratação.
// ─────────────────────────────────────────────────────────────────────────────
import type { Snapshot, SnapshotStore } from '@reconstrua/application';
import type { SqlClient, SqlRow } from './sql-client.js';
import { asDate } from './event-row.js';

export class PgSnapshotStore implements SnapshotStore {
  constructor(private readonly sql: SqlClient) {}

  async save<S>(snapshot: Snapshot<S>): Promise<void> {
    await this.sql.query(
      `INSERT INTO event_store.snapshots (stream_type, stream_id, version, state)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [snapshot.streamType, snapshot.streamId, snapshot.version, JSON.stringify(snapshot.state)],
    );
  }

  async load<S>(streamType: string, streamId: string): Promise<Snapshot<S> | null> {
    const rows = await this.sql.query<SqlRow>(
      `SELECT version, state, created_at
         FROM event_store.snapshots
        WHERE stream_type = $1 AND stream_id = $2
        ORDER BY version DESC
        LIMIT 1`,
      [streamType, streamId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      streamType,
      streamId,
      version: Number(row.version),
      state: row.state as S,
      createdAt: asDate(row.created_at),
    };
  }
}
