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

/** SqlClient falso que devolve o value JÁ PARSEADO (comportamento normal do driver
 *  postgres.js). Prova que a coerção NÃO regride escalares nem strings comuns. */
function parsedReturningSql(): SqlClient {
  const rows: Array<{ namespace: string; key: string; value: unknown }> = [];
  function run<T extends SqlRow = SqlRow>(text: string, params: readonly unknown[]): T[] {
    if (text.includes('INSERT INTO production.documents')) {
      const [namespace, key, valueText] = params as [string, string, string];
      const parsed: unknown = JSON.parse(valueText); // driver devolve como objeto/escalar JS
      const i = rows.findIndex((r) => r.namespace === namespace && r.key === key);
      if (i >= 0) rows[i]!.value = parsed;
      else rows.push({ namespace, key, value: parsed });
      return [];
    }
    if (text.includes('WHERE namespace = $1 AND key = $2')) {
      const [namespace, key] = params as [string, string];
      const r = rows.find((x) => x.namespace === namespace && x.key === key);
      return (r ? [{ value: r.value }] : []) as unknown as T[];
    }
    if (text.includes('WHERE namespace = $1')) {
      const [namespace] = params as [string];
      return rows
        .filter((r) => r.namespace === namespace)
        .map((r) => ({ value: r.value })) as unknown as T[];
    }
    return [];
  }
  return {
    query: <T extends SqlRow = SqlRow>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<T[]> => Promise.resolve(run<T>(text, params)),
    transaction: (work) => work(parsedReturningSql()),
  };
}

/** SqlClient falso: grava o value como TEXTO e o devolve como STRING (não objeto),
 *  imitando o driver que reproduz o BUG 1 em produção. */
function stringReturningSql(): SqlClient {
  const rows: Array<{ namespace: string; key: string; value: string }> = [];
  function run<T extends SqlRow = SqlRow>(text: string, params: readonly unknown[]): T[] {
    if (text.includes('INSERT INTO production.documents')) {
      const [namespace, key, value] = params as [string, string, string];
      const i = rows.findIndex((r) => r.namespace === namespace && r.key === key);
      if (i >= 0) rows[i]!.value = value;
      else rows.push({ namespace, key, value });
      return [];
    }
    if (text.includes('WHERE namespace = $1 AND key = $2')) {
      const [namespace, key] = params as [string, string];
      const r = rows.find((x) => x.namespace === namespace && x.key === key);
      return (r ? [{ value: r.value }] : []) as unknown as T[]; // value = STRING
    }
    if (text.includes('WHERE namespace = $1')) {
      const [namespace] = params as [string];
      return rows
        .filter((r) => r.namespace === namespace)
        .map((r) => ({ value: r.value })) as unknown as T[];
    }
    return [];
  }
  return {
    query: <T extends SqlRow = SqlRow>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<T[]> => Promise.resolve(run<T>(text, params)),
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
    await store.save({
      id: 'adm-1',
      role: 'administrador',
      name: 'Jessé Fundador',
      email: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    const admins = await store.byRole('administrador');
    expect(admins).toHaveLength(1);
    expect(admins[0]?.name).toBe('Jessé Fundador');
    expect(admins[0]?.active).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEM REGRESSÃO EM ESCALARES — a coerção só reinterpreta strings de objeto/array.
// Escalares (true/false/null/números) e strings comuns (inclusive as que "parecem"
// JSON, como 'true'/'42') fazem round-trip inalterados no modo NORMAL do driver.
// ─────────────────────────────────────────────────────────────────────────────
describe('PgJsonStore · escalares fazem round-trip sem regressão', () => {
  const casos: Array<{ nome: string; valor: unknown }> = [
    { nome: 'boolean true', valor: true },
    { nome: 'boolean false', valor: false },
    { nome: 'número inteiro', valor: 42 },
    { nome: 'número decimal', valor: 3.14 },
    { nome: 'número zero', valor: 0 },
    { nome: 'string comum', valor: 'hello' },
    { nome: 'string vazia', valor: '' },
    { nome: 'string que PARECE booleano', valor: 'true' },
    { nome: 'string que PARECE número', valor: '42' },
    { nome: 'string que PARECE null', valor: 'null' },
    { nome: 'objeto', valor: { role: 'administrador', active: true } },
    { nome: 'array', valor: [1, 2, 3] },
  ];

  it('driver PARSEADO (normal): cada valor volta idêntico — escalares nunca reinterpretados', async () => {
    const json = new PgJsonStore(parsedReturningSql());
    for (const { nome, valor } of casos) {
      await json.put('scalars', nome, valor);
      expect(await json.get('scalars', nome), nome).toEqual(valor);
    }
    // A prova-chave da NÃO-regressão: 'true' continua string, não vira booleano.
    expect(typeof (await json.get('scalars', 'string que PARECE booleano'))).toBe('string');
    expect(typeof (await json.get('scalars', 'string que PARECE número'))).toBe('string');
  });

  it('driver STRING (o bug): objetos/arrays são normalizados; escalares preservados', async () => {
    const json = new PgJsonStore(stringReturningSql());
    // Objetos e arrays: normalizados de volta para estrutura.
    await json.put('s', 'obj', { a: 1 });
    await json.put('s', 'arr', [1, 2]);
    expect(await json.get('s', 'obj')).toEqual({ a: 1 });
    expect(await json.get('s', 'arr')).toEqual([1, 2]);
  });

  it('null verdadeiro (JS null) e ausência de linha → get devolve null', async () => {
    const json = new PgJsonStore(parsedReturningSql());
    expect(await json.get('vazio', 'inexistente')).toBeNull(); // sem linha
    await json.put('vazio', 'nulo', null);
    expect(await json.get('vazio', 'nulo')).toBeNull(); // null gravado
  });
});
