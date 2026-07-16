// ─────────────────────────────────────────────────────────────────────────────
// PgMediaStore — MediaStorePort sobre production.media_blobs (bytea). A tabela é
// criada pela migration 05-media.sql (MIG-01); NÃO há DDL/ensureSchema aqui.
// Reutiliza a interface SqlClient já existente (apenas o tipo — não altera o
// Event Store). INSERT idempotente por sha256 (ON CONFLICT DO NOTHING).
// ─────────────────────────────────────────────────────────────────────────────
import type { SqlClient } from '../event-store/sql-client.js';
import type { MediaStorePort, StoredBlob } from './media-store-port.js';

export class PgMediaStore implements MediaStorePort {
  constructor(private readonly sql: SqlClient) {}

  async has(sha256: string): Promise<boolean> {
    const rows = await this.sql.query('SELECT 1 FROM production.media_blobs WHERE sha256 = $1', [sha256]);
    return rows.length > 0;
  }

  async put(blob: StoredBlob): Promise<void> {
    await this.sql.query(
      'INSERT INTO production.media_blobs (sha256, mime, size, bytes) VALUES ($1, $2, $3, $4) ON CONFLICT (sha256) DO NOTHING',
      [blob.sha256, blob.mime, blob.size, Buffer.from(blob.bytes)],
    );
  }
}
