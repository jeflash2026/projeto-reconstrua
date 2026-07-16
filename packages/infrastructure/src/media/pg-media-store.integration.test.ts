// ─────────────────────────────────────────────────────────────────────────────
// Integração PgMediaStore — roda somente com DATABASE_URL (padrão do repo: pulado
// sem banco). Prova has/put/dedup contra o Postgres real (tabela media_blobs).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { PostgresSqlClient } from '../event-store/postgres-sql-client.js';
import { PgMediaStore } from './pg-media-store.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('PgMediaStore (integração Postgres)', () => {
  it('put persiste e has confirma; put repetido é idempotente (dedup)', async () => {
    const sql = PostgresSqlClient.connect(DATABASE_URL as string);
    try {
      const store = new PgMediaStore(sql);
      const sha256 = `test-${String(Date.now())}`;
      const blob = { sha256, mime: 'application/pdf', size: 4, bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) };
      expect(await store.has(sha256)).toBe(false);
      await store.put(blob);
      expect(await store.has(sha256)).toBe(true);
      await store.put(blob); // ON CONFLICT DO NOTHING
      expect(await store.has(sha256)).toBe(true);
    } finally {
      await sql.close();
    }
  });
});
