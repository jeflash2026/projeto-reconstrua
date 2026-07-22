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
    const rows = await this.sql.query('SELECT 1 FROM production.media_blobs WHERE sha256 = $1', [
      sha256,
    ]);
    return rows.length > 0;
  }

  async put(blob: StoredBlob): Promise<void> {
    await this.sql.query(
      'INSERT INTO production.media_blobs (sha256, mime, size, bytes) VALUES ($1, $2, $3, $4) ON CONFLICT (sha256) DO NOTHING',
      [blob.sha256, blob.mime, blob.size, Buffer.from(blob.bytes)],
    );
  }

  async read(sha256: string): Promise<StoredBlob | null> {
    // CAUSA RAIZ (caso Maria, 2026-07-22): o driver `postgres` devolvia a coluna
    // `bytea` num formato que `new Uint8Array(row['bytes'])` reduzia a comprimento
    // ZERO — o PDF chegava vazio à Vision ("PDF cannot be empty", HTTP 400) e a
    // leitura falhava para TODOS os documentos. Correção à prova de driver: o
    // PRÓPRIO Postgres serializa o blob em base64 (texto), que todo driver retorna
    // de forma confiável; o JS só decodifica. Independe de como o driver trata bytea.
    const rows = await this.sql.query(
      "SELECT mime, size, encode(bytes, 'base64') AS bytes_b64 FROM production.media_blobs WHERE sha256 = $1",
      [sha256],
    );
    const row = rows[0];
    if (!row) return null;
    const b64 = row['bytes_b64'];
    // Buffer.from(base64) ignora as quebras de linha que o encode() do Postgres
    // insere a cada 76 chars — decodifica o blob íntegro.
    const bytes =
      typeof b64 === 'string' ? new Uint8Array(Buffer.from(b64, 'base64')) : new Uint8Array(0);
    return {
      sha256,
      mime: String(row['mime']),
      size: Number(row['size']),
      bytes,
    };
  }
}
