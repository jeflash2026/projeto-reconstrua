// ─────────────────────────────────────────────────────────────────────────────
// Teste de INTEGRAÇÃO do PgEventStore — exercita o adapter contra um PostgreSQL
// real. É PULADO automaticamente quando DATABASE_URL não está definido (ambiente
// sem banco; servidores são do dono). No ambiente de integração do dono, valida as
// garantias de nível de banco (append-only por trigger, unicidade de versão,
// outbox atômica). Usa streams com id aleatório, sem necessidade de limpeza.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NO_STREAM, atVersion, ConcurrencyConflictError } from '@reconstrua/application';
import type { UncommittedEvent } from '@reconstrua/application';
import { PostgresSqlClient } from './postgres-sql-client.js';
import { PgEventStore } from './pg-event-store.js';
import { PgOutboxStore } from './pg-outbox-store.js';
import { CryptoHasher } from './crypto-hasher.js';
import { UuidV4Generator } from './system-clock.js';

const url = process.env.DATABASE_URL ?? '';
const uuid = new UuidV4Generator();

function ev(n: number): UncommittedEvent {
  return { eventType: 'it.happened', isRelevant: false, payload: { n }, occurredAt: new Date() };
}

describe.skipIf(url === '')('PgEventStore (integração — requer DATABASE_URL)', () => {
  let client!: PostgresSqlClient;
  let store!: PgEventStore;
  let outbox!: PgOutboxStore;

  beforeAll(() => {
    client = PostgresSqlClient.connect(url);
    store = new PgEventStore(client, new CryptoHasher(), uuid);
    outbox = new PgOutboxStore(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('anexa, relê e versiona num stream novo; enfileira a outbox', async () => {
    const id = uuid.next();
    const result = await store.append('it-mission', id, NO_STREAM, [ev(1), ev(2)]);
    expect(result.version).toBe(2);
    const events = await store.readStream('it-mission', id, 0);
    expect(events.map((e) => e.version)).toEqual([1, 2]);
    expect(await store.streamVersion('it-mission', id)).toBe(2);
    const pending = await outbox.fetchUnpublished(1000);
    expect(pending.some((e) => e.streamId === id)).toBe(true);
  });

  it('conflita ao anexar em versão obsoleta', async () => {
    const id = uuid.next();
    await store.append('it-mission', id, NO_STREAM, [ev(1)]);
    await expect(store.append('it-mission', id, atVersion(0), [ev(2)])).rejects.toBeInstanceOf(
      ConcurrencyConflictError,
    );
    await expect(store.append('it-mission', id, atVersion(1), [ev(2)])).resolves.toBeDefined();
  });
});
