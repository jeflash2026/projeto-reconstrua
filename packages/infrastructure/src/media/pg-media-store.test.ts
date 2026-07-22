// ─────────────────────────────────────────────────────────────────────────────
// PgMediaStore.read — REGRESSÃO do caso Maria (2026-07-22): o driver `postgres`
// devolvia `bytea` num formato que `new Uint8Array(row['bytes'])` zerava, e o PDF
// chegava VAZIO à Vision ("PDF cannot be empty"). A correção lê o blob já em
// base64 (encode() no Postgres) e decodifica no JS — à prova de driver. Estes
// testes usam um SqlClient falso (sem Postgres) que emula o encode('base64').
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { SqlClient, SqlRow } from '../event-store/sql-client.js';
import { PgMediaStore } from './pg-media-store.js';

/** SqlClient falso: para a query de leitura, emula o Postgres devolvendo
 *  `encode(bytes,'base64')` (com as quebras de linha a cada 76 chars). */
function fakeSql(blob: { mime: string; size: number; bytes: Uint8Array } | null): {
  sql: SqlClient;
  lastQuery: () => string;
} {
  let last = '';
  const sql: SqlClient = {
    query: <T extends SqlRow = SqlRow>(text: string): Promise<T[]> => {
      last = text;
      if (blob === null) return Promise.resolve([]);
      // O encode('base64') do Postgres quebra a linha a cada 76 caracteres.
      const b64 = Buffer.from(blob.bytes)
        .toString('base64')
        .replace(/(.{76})/g, '$1\n');
      return Promise.resolve([
        { mime: blob.mime, size: blob.size, bytes_b64: b64 } as unknown as T,
      ]);
    },
    transaction: <T>(work: (tx: SqlClient) => Promise<T>): Promise<T> => work(sql),
  };
  return { sql, lastQuery: () => last };
}

describe('PgMediaStore.read (bytea via base64 — à prova de driver)', () => {
  it('decodifica o blob íntegro, mesmo grande e com quebras de linha do encode()', async () => {
    // Blob "grande" (> 76 bytes ⇒ base64 multilinha) com bytes não-ASCII, como um PDF.
    const original = new Uint8Array(1000);
    for (let i = 0; i < original.length; i += 1) original[i] = (i * 37 + 11) % 256;
    const { sql } = fakeSql({ mime: 'application/pdf', size: original.length, bytes: original });
    const store = new PgMediaStore(sql);

    const blob = await store.read('sha-teste');

    expect(blob).not.toBeNull();
    expect(blob?.mime).toBe('application/pdf');
    expect(blob?.size).toBe(1000);
    // O CORAÇÃO da regressão: os bytes NÃO chegam vazios.
    expect(blob?.bytes.length).toBe(1000);
    expect(Array.from(blob?.bytes ?? [])).toEqual(Array.from(original));
  });

  it('pede o blob em base64 (guarda contra volta ao bytea cru, que quebrava a Vision)', async () => {
    const { sql, lastQuery } = fakeSql({
      mime: 'application/pdf',
      size: 4,
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });
    await new PgMediaStore(sql).read('sha-teste');
    expect(lastQuery()).toMatch(/encode\(\s*bytes\s*,\s*'base64'\s*\)/i);
  });

  it('sha inexistente ⇒ null', async () => {
    const { sql } = fakeSql(null);
    expect(await new PgMediaStore(sql).read('nao-existe')).toBeNull();
  });
});
