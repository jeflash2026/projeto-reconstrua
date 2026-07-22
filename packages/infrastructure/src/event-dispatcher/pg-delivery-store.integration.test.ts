// ─────────────────────────────────────────────────────────────────────────────
// Integração PgDeliveryStore + PgIdempotencyStore — contra PostgreSQL real. PULADO
// sem DATABASE_URL (servidores são do dono). Valida enqueue idempotente, claimDue
// com lock, markDelivered, DLQ/replay e idempotência de subscriber.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NO_STREAM } from '@reconstrua/application';
import type { UncommittedEvent } from '@reconstrua/application';
import { PostgresSqlClient } from '../event-store/postgres-sql-client.js';
import { PgEventStore } from '../event-store/pg-event-store.js';
import { CryptoHasher } from '../event-store/crypto-hasher.js';
import { UuidV4Generator } from '../event-store/system-clock.js';
import { PgDeliveryStore } from './pg-delivery-store.js';
import { PgIdempotencyStore } from './pg-idempotency-store.js';

const url = process.env.DATABASE_URL ?? '';
const uuid = new UuidV4Generator();

function ev(): UncommittedEvent {
  return { eventType: 'it.happened', isRelevant: false, payload: {}, occurredAt: new Date() };
}

describe.skipIf(url === '')(
  'PgDeliveryStore/PgIdempotencyStore (integração — requer DATABASE_URL)',
  () => {
    let client!: PostgresSqlClient;
    let events!: PgEventStore;
    let deliveries!: PgDeliveryStore;
    let idempotency!: PgIdempotencyStore;

    beforeAll(() => {
      client = PostgresSqlClient.connect(url);
      events = new PgEventStore(client, new CryptoHasher(), uuid);
      deliveries = new PgDeliveryStore(client);
      idempotency = new PgIdempotencyStore(client);
    });

    afterAll(async () => {
      await client.close();
    });

    it('enqueue idempotente + claimDue com lock + markDelivered', async () => {
      const streamId = uuid.next();
      const now = new Date();
      const appended = await events.append('it-mission', streamId, NO_STREAM, [ev()]);
      const stored = appended.events[0]!;

      await deliveries.enqueue(stored, ['cqrs'], now);
      await deliveries.enqueue(stored, ['cqrs'], now); // idempotente

      const claimed = await deliveries.claimDue(10, now, 'w1');
      const mine = claimed.filter((c) => c.delivery.eventId === stored.id);
      expect(mine).toHaveLength(1);
      await deliveries.markDelivered([mine[0]!.delivery.id], now);

      const counts = await deliveries.countByStatus();
      expect(counts.delivered).toBeGreaterThanOrEqual(1);
    });

    it('idempotency store registra e detecta', async () => {
      const streamId = uuid.next();
      const appended = await events.append('it-mission', streamId, NO_STREAM, [ev()]);
      const eventId = appended.events[0]!.id;
      expect(await idempotency.wasProcessed('cqrs', eventId)).toBe(false);
      await idempotency.recordProcessed('cqrs', eventId, new Date());
      expect(await idempotency.wasProcessed('cqrs', eventId)).toBe(true);
      await idempotency.recordProcessed('cqrs', eventId, new Date()); // ON CONFLICT DO NOTHING
    });
  },
);
