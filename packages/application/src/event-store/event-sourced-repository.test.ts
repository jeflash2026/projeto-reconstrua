// ─────────────────────────────────────────────────────────────────────────────
// Testes do EventSourcedRepository — reidratação, snapshot lazy e integridade.
// Usa um Event Store / Snapshot Store in-memory inline (fakes de teste).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { EventSourcedRepository } from './event-sourced-repository.js';
import { computeHash } from './hash-chain.js';
import type { EventStore, Hasher, Snapshot, SnapshotStore } from './ports.js';
import type {
  AppendResult,
  EventProvenance,
  ExpectedVersion,
  StoredEvent,
  UncommittedEvent,
} from './stored-event.js';
import { normalizeProvenance } from './stored-event.js';
import { ConcurrencyConflictError } from './errors.js';

const hasher: Hasher = {
  hash(input: string): string {
    let h = 5381;
    for (let i = 0; i < input.length; i += 1) h = (h * 33) ^ input.charCodeAt(i);
    return (h >>> 0).toString(16).padStart(8, '0');
  },
};

// Event Store in-memory mínimo, com cadeia de hash real (para verifyIntegrity).
class TinyStore implements EventStore {
  private readonly streams = new Map<string, StoredEvent[]>();
  private seq = 0;
  private key(t: string, i: string): string {
    return `${t}:${i}`;
  }
  append(
    streamType: string,
    streamId: string,
    expected: ExpectedVersion,
    events: readonly UncommittedEvent[],
    provenanceDefault?: EventProvenance,
  ): Promise<AppendResult> {
    const list = this.streams.get(this.key(streamType, streamId)) ?? [];
    const current = list.length;
    if (expected.kind === 'no-stream' && current !== 0) {
      return Promise.reject(new ConcurrencyConflictError(streamType, streamId, expected, current));
    }
    if (expected.kind === 'exact' && expected.version !== current) {
      return Promise.reject(new ConcurrencyConflictError(streamType, streamId, expected, current));
    }
    let previousHash = list.length > 0 ? list[list.length - 1]!.hash : null;
    let version = current;
    const appended: StoredEvent[] = [];
    for (const e of events) {
      version += 1;
      this.seq += 1;
      const provenance = normalizeProvenance(e.provenance ?? provenanceDefault);
      const core = {
        streamType,
        streamId,
        version,
        eventType: e.eventType,
        isRelevant: e.isRelevant,
        payload: e.payload,
        provenance,
        occurredAt: e.occurredAt,
      };
      const hash = computeHash(previousHash, core, hasher);
      const stored: StoredEvent = {
        ...core,
        id: `${streamType}-${streamId}-${String(version)}`,
        previousHash,
        hash,
        recordedAt: new Date('2026-07-14T00:00:00.000Z'),
        globalSeq: this.seq,
      };
      appended.push(stored);
      previousHash = hash;
    }
    this.streams.set(this.key(streamType, streamId), [...list, ...appended]);
    return Promise.resolve({ events: appended, version });
  }
  readStream(streamType: string, streamId: string, fromVersion = 0): Promise<readonly StoredEvent[]> {
    const list = this.streams.get(this.key(streamType, streamId)) ?? [];
    return Promise.resolve(list.filter((e) => e.version > fromVersion));
  }
  readAll(): Promise<readonly StoredEvent[]> {
    return Promise.resolve([...this.streams.values()].flat().sort((a, b) => a.globalSeq - b.globalSeq));
  }
  streamVersion(streamType: string, streamId: string): Promise<number> {
    return Promise.resolve((this.streams.get(this.key(streamType, streamId)) ?? []).length);
  }
}

class TinySnapshots implements SnapshotStore {
  private readonly snaps = new Map<string, Snapshot<unknown>>();
  saved = 0;
  save<S>(snapshot: Snapshot<S>): Promise<void> {
    this.snaps.set(`${snapshot.streamType}:${snapshot.streamId}`, snapshot);
    this.saved += 1;
    return Promise.resolve();
  }
  load<S>(streamType: string, streamId: string): Promise<Snapshot<S> | null> {
    return Promise.resolve((this.snaps.get(`${streamType}:${streamId}`) as Snapshot<S> | undefined) ?? null);
  }
}

interface Counter {
  readonly count: number;
}
const ev = (n: number): UncommittedEvent => ({
  eventType: 'ticked',
  isRelevant: false,
  payload: { n },
  occurredAt: new Date('2026-07-14T00:00:00.000Z'),
});
const fold = (s: Counter): Counter => ({ count: s.count + 1 });

function repo(store: EventStore, snaps?: SnapshotStore, snapshotEvery?: number) {
  return new EventSourcedRepository<Counter>({
    streamType: 'counter',
    seed: { count: 0 },
    fold,
    eventStore: store,
    ...(snaps ? { snapshotStore: snaps } : {}),
    ...(snapshotEvery !== undefined ? { snapshotEvery } : {}),
  });
}

describe('EventSourcedRepository', () => {
  it('reidrata o estado a partir dos eventos', async () => {
    const store = new TinyStore();
    const r = repo(store);
    await r.appendEvents('c1', { kind: 'no-stream' }, [ev(1), ev(2), ev(3)]);
    const loaded = await r.load('c1');
    expect(loaded).not.toBeNull();
    expect(loaded!.state.count).toBe(3);
    expect(loaded!.version).toBe(3);
  });

  it('retorna null para stream inexistente', async () => {
    const r = repo(new TinyStore());
    expect(await r.load('nada')).toBeNull();
  });

  it('grava snapshot lazy quando a cauda atinge snapshotEvery e reusa na próxima leitura', async () => {
    const store = new TinyStore();
    const snaps = new TinySnapshots();
    const r = repo(store, snaps, 2);
    await r.appendEvents('c2', { kind: 'no-stream' }, [ev(1), ev(2), ev(3)]);
    await r.load('c2'); // cauda 3 >= 2 → snapshot gravado
    expect(snaps.saved).toBe(1);
    const snap = await snaps.load<Counter>('counter', 'c2');
    expect(snap?.version).toBe(3);
    expect(snap?.state.count).toBe(3);
    // Segunda leitura parte do snapshot (cauda 0), sem novo snapshot.
    const again = await r.load('c2');
    expect(again!.state.count).toBe(3);
    expect(snaps.saved).toBe(1);
  });

  it('respeita concorrência otimista (expected version)', async () => {
    const store = new TinyStore();
    const r = repo(store);
    await r.appendEvents('c3', { kind: 'no-stream' }, [ev(1)]);
    await expect(r.appendEvents('c3', { kind: 'no-stream' }, [ev(2)])).rejects.toBeInstanceOf(
      ConcurrencyConflictError,
    );
    await expect(r.appendEvents('c3', { kind: 'exact', version: 1 }, [ev(2)])).resolves.toBeDefined();
  });

  it('verifica integridade da cadeia (R9)', async () => {
    const store = new TinyStore();
    const r = repo(store);
    await r.appendEvents('c4', { kind: 'no-stream' }, [ev(1), ev(2), ev(3)]);
    await expect(r.verifyIntegrity('c4', hasher)).resolves.toBeUndefined();
  });
});
