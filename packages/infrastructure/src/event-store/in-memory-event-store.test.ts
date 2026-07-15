// ─────────────────────────────────────────────────────────────────────────────
// Testes do InMemoryEventStore — roda a suíte de CONTRATO completa (append-only,
// concorrência, integridade, outbox, reidratação, stress) + verificações
// específicas do adapter (snapshot store, readAll global).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { NO_STREAM } from '@reconstrua/application';
import { InMemoryEventStore } from './in-memory-event-store.js';
import { InMemorySnapshotStore } from './in-memory-snapshot-store.js';
import { CryptoHasher } from './crypto-hasher.js';
import { SystemClock, UuidV4Generator } from './system-clock.js';
import { runEventStoreContract, type EventStoreHarness } from './event-store-contract.js';

function makeHarness(): EventStoreHarness {
  const hasher = new CryptoHasher();
  const store = new InMemoryEventStore(hasher, new UuidV4Generator(), new SystemClock());
  return { eventStore: store, outbox: store, hasher };
}

runEventStoreContract('InMemory', makeHarness);

describe('InMemoryEventStore — específico', () => {
  it('readAll retorna em ordem global monotônica entre streams', async () => {
    const store = new InMemoryEventStore(new CryptoHasher(), new UuidV4Generator(), new SystemClock());
    const e = (n: number) => ({
      eventType: 't',
      isRelevant: false,
      payload: { n },
      occurredAt: new Date('2026-07-14T00:00:00.000Z'),
    });
    await store.append('a', '00000000-0000-4000-8000-00000000aa01', NO_STREAM, [e(1)]);
    await store.append('b', '00000000-0000-4000-8000-00000000bb01', NO_STREAM, [e(2)]);
    await store.append('a', '00000000-0000-4000-8000-00000000aa01', { kind: 'exact', version: 1 }, [e(3)]);
    const all = await store.readAll(0, 100);
    expect(all.map((x) => x.globalSeq)).toEqual([1, 2, 3]);
    expect(all.map((x) => x.streamType)).toEqual(['a', 'b', 'a']);
  });

  it('snapshot store guarda e recupera o mais recente', async () => {
    const snaps = new InMemorySnapshotStore();
    await snaps.save({
      streamType: 's',
      streamId: 'x',
      version: 5,
      state: { total: 50 },
      createdAt: new Date('2026-07-14T00:00:00.000Z'),
    });
    const loaded = await snaps.load<{ total: number }>('s', 'x');
    expect(loaded?.version).toBe(5);
    expect(loaded?.state.total).toBe(50);
    expect(await snaps.load('s', 'inexistente')).toBeNull();
  });
});
