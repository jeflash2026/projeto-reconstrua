// ─────────────────────────────────────────────────────────────────────────────
// GO-LIVE-06.2 · CAUSA RAIZ do BUG 1 — reprodução SEM banco: um SqlClient falso
// que devolve a coluna jsonb `value` como STRING JSON (comportamento possível do
// driver via sql.unsafe). Antes do coerceJson, JsonStaffStore.byRole não achava o
// administrador (filtro por `.role` numa string → undefined). Depois, acha.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { SqlClient, SqlRow } from '../event-store/sql-client.js';
import { PgJsonStore } from './json-store.js';
import { JsonStaffStore } from './document-stores.js';

/** SqlClient falso: grava o value como TEXTO e o devolve como STRING (não objeto),
 *  imitando o driver que reproduz o BUG 1 em produção. */
function stringReturningSql(): SqlClient {
  const rows: Array<{ namespace: string; key: string; value: string }> = [];
  function run<T extends SqlRow = SqlRow>(text: string, params: readonly unknown[]): T[] {
    if (text.includes('INSERT INTO production.documents')) {
      const [namespace, key, value] = params as [string, string, string];
      const i = rows.findIndex((r) => r.namespace === namespace && r.key === key);
      if (i >= 0) rows[i]!.value = value; else rows.push({ namespace, key, value });
      return [];
    }
    if (text.includes('WHERE namespace = $1 AND key = $2')) {
      const [namespace, key] = params as [string, string];
      const r = rows.find((x) => x.namespace === namespace && x.key === key);
      return (r ? [{ value: r.value }] : []) as unknown as T[]; // value = STRING
    }
    if (text.includes('WHERE namespace = $1')) {
      const [namespace] = params as [string];
      return rows.filter((r) => r.namespace === namespace).map((r) => ({ value: r.value })) as unknown as T[];
    }
    return [];
  }
  return {
    query: <T extends SqlRow = SqlRow>(text: string, params: readonly unknown[] = []): Promise<T[]> =>
      Promise.resolve(run<T>(text, params)),
    transaction: (work) => work(stringReturningSql()),
  };
}

describe('PgJsonStore · jsonb devolvido como STRING (causa raiz do BUG 1)', () => {
  it('get normaliza a string JSON para OBJETO', async () => {
    const json = new PgJsonStore(stringReturningSql());
    await json.put('config', 'k', { a: 1, nested: { b: 2 } });
    const back = await json.get('config', 'k');
    expect(typeof back).toBe('object');
    expect(back).toMatchObject({ a: 1, nested: { b: 2 } });
  });

  it('list normaliza cada string para OBJETO — e byRole volta a achar o administrador', async () => {
    const sql = stringReturningSql();
    const store = new JsonStaffStore(new PgJsonStore(sql));
    const now = new Date();
    await store.save({ id: 'adm-1', role: 'administrador', name: 'Jessé Fundador', email: null, active: true, createdAt: now, updatedAt: now });

    const admins = await store.byRole('administrador');
    expect(admins).toHaveLength(1);
    expect(admins[0]?.name).toBe('Jessé Fundador');
    expect(admins[0]?.active).toBe(true);
  });
});
