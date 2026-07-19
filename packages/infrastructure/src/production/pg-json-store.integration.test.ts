// ─────────────────────────────────────────────────────────────────────────────
// Teste de INTEGRAÇÃO do PgJsonStore (GO-LIVE-06.1) — exercita o caminho de
// ESCRITA (put) e LEITURA (get/list) contra um PostgreSQL real. Este caminho
// nunca tinha cobertura de integração; o BUG 1 (seed do administrador que "não
// surtia efeito") mora exatamente aqui. Pulado quando DATABASE_URL não está
// definido (ambiente sem banco). Usa chaves com sufixo aleatório — sem limpeza.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresSqlClient } from '../event-store/postgres-sql-client.js';
import { PgJsonStore } from './json-store.js';
import { JsonStaffStore } from './document-stores.js';

const url = process.env.DATABASE_URL ?? '';
const suffix = Math.random().toString(36).slice(2, 10);

describe.skipIf(url === '')('PgJsonStore (integração — requer DATABASE_URL)', () => {
  let client!: PostgresSqlClient;
  let json!: PgJsonStore;

  beforeAll(() => {
    client = PostgresSqlClient.connect(url);
    json = new PgJsonStore(client);
  });
  afterAll(async () => {
    await client.close();
  });

  it('put grava jsonb e get/list releem como OBJETO (não string) — o cerne do BUG 1', async () => {
    const key = `it-${suffix}`;
    const value = { role: 'administrador', name: 'Jessé Fundador', active: true, when: new Date().toISOString() };
    await json.put('staff', key, value);

    const back = await json.get('staff', key);
    expect(typeof back).toBe('object'); // jsonb volta como objeto — se viesse string, o BUG 1 se manifesta
    expect(back).toMatchObject({ role: 'administrador', name: 'Jessé Fundador', active: true });

    const all = await json.list('staff');
    expect(all.some((v) => (v as { name?: string }).name === 'Jessé Fundador')).toBe(true);
  });

  it('JsonStaffStore.save → byRole encontra o administrador (write→read ponta a ponta)', async () => {
    const store = new JsonStaffStore(json);
    const id = `adm-${suffix}`;
    const now = new Date();
    await store.save({ id, role: 'administrador', name: 'Admin Prod', email: null, active: true, createdAt: now, updatedAt: now });

    const admins = await store.byRole('administrador');
    expect(admins.some((m) => m.id === id && m.active)).toBe(true);
  });
});
