// ─────────────────────────────────────────────────────────────────────────────
// Testes de INTEGRAÇÃO do OutboxRuntime — o caminho completo Event Store → Outbox →
// Ledger de Entregas → Subscribers. Cobre: fan-out, entrega, retry+backoff, DLQ/
// poison, idempotência, isolamento de falhas, ordenação por stream (head-of-line),
// recovery, concorrência de workers, stress e métricas.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type { EventSubscriber, StoredEvent, UncommittedEvent } from '@reconstrua/application';
import {
  NO_STREAM,
  OutboxRuntime,
  SubscriberRegistry,
  ExponentialBackoffRetryPolicy,
  InMemoryDispatchMetrics,
} from '@reconstrua/application';
import { InMemoryEventStore } from '../event-store/in-memory-event-store.js';
import { CryptoHasher } from '../event-store/crypto-hasher.js';
import { UuidV4Generator } from '../event-store/system-clock.js';
import { InMemoryDeliveryStore } from './in-memory-delivery-store.js';
import { InMemoryIdempotencyStore } from './in-memory-idempotency-store.js';

class TestClock implements Clock {
  constructor(private t: Date) {}
  now(): Date {
    return new Date(this.t.getTime());
  }
  advance(ms: number): void {
    this.t = new Date(this.t.getTime() + ms);
  }
}

interface SeenEvent {
  eventType: string;
  streamId: string;
  version: number;
  id: string;
}

interface RecorderOptions {
  readonly interestedIn?: readonly string[];
  readonly alwaysFail?: boolean;
}

function recorder(name: string, opts: RecorderOptions = {}) {
  const seen: SeenEvent[] = [];
  let calls = 0;
  const sub: EventSubscriber = {
    name,
    ...(opts.interestedIn ? { interestedIn: opts.interestedIn } : {}),
    handle(e: StoredEvent): Promise<void> {
      calls += 1;
      if (opts.alwaysFail) return Promise.reject(new Error(`falha ${name} #${String(calls)}`));
      seen.push({ eventType: e.eventType, streamId: e.streamId, version: e.version, id: e.id });
      return Promise.resolve();
    },
  };
  return { sub, seen, calls: () => calls };
}

function harness(retry?: { maxAttempts: number }) {
  const clock = new TestClock(new Date('2026-07-14T00:00:00.000Z'));
  const store = new InMemoryEventStore(new CryptoHasher(), new UuidV4Generator(), clock);
  const deliveries = new InMemoryDeliveryStore();
  const idempotency = new InMemoryIdempotencyStore();
  const registry = new SubscriberRegistry();
  const metrics = new InMemoryDispatchMetrics();
  const retryPolicy = new ExponentialBackoffRetryPolicy({
    baseMs: 1000,
    factor: 2,
    maxMs: 60_000,
    maxAttempts: retry?.maxAttempts ?? 3,
    jitter: 0,
  });
  const runtime = new OutboxRuntime(
    { outbox: store, deliveries, idempotency, registry, retryPolicy, clock, metrics },
    { workerId: 'w1', staleLockMs: 5000 },
  );
  return { clock, store, deliveries, idempotency, registry, metrics, runtime };
}

function ev(version: number): UncommittedEvent {
  return { eventType: 'thing.happened', isRelevant: false, payload: { version }, occurredAt: new Date(0) };
}

const MID = '00000000-0000-4000-8000-000000000001';

describe('OutboxRuntime — fan-out e entrega', () => {
  it('distribui cada evento a todos os subscribers interessados', async () => {
    const h = harness();
    const cqrs = recorder('cqrs');
    const notif = recorder('notifications');
    h.registry.register(cqrs.sub).register(notif.sub);
    await h.store.append('mission', MID, NO_STREAM, [ev(1), ev(2)]);
    await h.runtime.drainToIdle();
    expect(cqrs.seen.map((x) => x.version)).toEqual([1, 2]);
    expect(notif.seen.map((x) => x.version)).toEqual([1, 2]);
    expect((await h.deliveries.countByStatus()).delivered).toBe(4);
    expect(h.metrics.snapshot().delivered).toBe(4);
    expect(h.metrics.snapshot().fannedOut).toBe(4);
  });
});

describe('OutboxRuntime — isolamento de falhas', () => {
  it('a falha de um subscriber não impede os demais', async () => {
    const h = harness();
    const good = recorder('good');
    const bad = recorder('bad', { alwaysFail: true });
    h.registry.register(good.sub).register(bad.sub);
    await h.store.append('mission', MID, NO_STREAM, [ev(1)]);
    await h.runtime.tick();
    expect(good.seen).toHaveLength(1); // entregue mesmo com 'bad' falhando
    expect((await h.deliveries.countByStatus()).delivered).toBe(1);
    expect(h.metrics.snapshot().failed).toBeGreaterThanOrEqual(1);
  });
});

describe('OutboxRuntime — retry, backoff, DLQ (poison) e replay', () => {
  it('reprocessa com backoff, envia à DLQ após maxAttempts e permite replay', async () => {
    const h = harness({ maxAttempts: 3 });
    let shouldFail = true;
    const seen: number[] = [];
    let calls = 0;
    const ctrl: EventSubscriber = {
      name: 'ctrl',
      handle(e: StoredEvent): Promise<void> {
        calls += 1;
        if (shouldFail) return Promise.reject(new Error('transitório'));
        seen.push(e.version);
        return Promise.resolve();
      },
    };
    h.registry.register(ctrl);
    await h.store.append('mission', MID, NO_STREAM, [ev(1)]);

    await h.runtime.tick(); // tentativa 1 → falha → reagenda (+1000ms)
    expect(calls).toBe(1);
    expect((await h.deliveries.countByStatus()).pending).toBe(1);

    h.clock.advance(1000);
    await h.runtime.tick(); // tentativa 2 → falha → reagenda (+2000ms)
    expect(calls).toBe(2);

    h.clock.advance(2000);
    await h.runtime.tick(); // tentativa 3 → decide(3)=sem retry → DLQ
    expect(calls).toBe(3);
    expect((await h.deliveries.countByStatus()).dead).toBe(1);
    expect(h.metrics.snapshot().deadLettered).toBe(1);

    // Replay da DLQ com o subscriber já saudável.
    shouldFail = false;
    const dl = await h.deliveries.listDeadLetters(10);
    await h.deliveries.replay(dl[0]!.id, h.clock.now());
    await h.runtime.drainToIdle();
    expect(seen).toEqual([1]);
    expect((await h.deliveries.countByStatus()).delivered).toBe(1);
  });
});

describe('OutboxRuntime — idempotência', () => {
  it('não processa duas vezes o mesmo (subscriber, evento)', async () => {
    const h = harness();
    const rec = recorder('cqrs');
    h.registry.register(rec.sub);
    await h.store.append('mission', MID, NO_STREAM, [ev(1)]);
    await h.runtime.fanOutOnce();
    const events = await h.store.readAll(0, 10);
    await h.idempotency.recordProcessed('cqrs', events[0]!.id, h.clock.now());
    await h.runtime.deliverOnce();
    expect(rec.calls()).toBe(0); // pulado por idempotência
    expect((await h.deliveries.countByStatus()).delivered).toBe(1);
    expect(h.metrics.snapshot().skippedIdempotent).toBe(1);
  });
});

describe('OutboxRuntime — ordenação por stream (head-of-line)', () => {
  it('preserva a ordem: v2/v3 nunca antes de v1, mesmo com falha transitória em v1', async () => {
    const h = harness();
    let failedV1 = false;
    const ordered: number[] = [];
    const sub: EventSubscriber = {
      name: 'cqrs',
      handle(e: StoredEvent): Promise<void> {
        if (e.version === 1 && !failedV1) {
          failedV1 = true;
          return Promise.reject(new Error('v1 transitório'));
        }
        ordered.push(e.version);
        return Promise.resolve();
      },
    };
    h.registry.register(sub);
    await h.store.append('mission', MID, NO_STREAM, [ev(1), ev(2), ev(3)]);

    await h.runtime.tick(); // reivindica só v1 → falha → v2/v3 bloqueados
    expect(ordered).toEqual([]);

    h.clock.advance(1000);
    await h.runtime.drainToIdle(); // v1 → v2 → v3, em ordem
    expect(ordered).toEqual([1, 2, 3]);
  });
});

describe('OutboxRuntime — recovery', () => {
  it('releaseStale recupera entregas travadas por worker morto', async () => {
    const h = harness();
    const rec = recorder('cqrs');
    h.registry.register(rec.sub);
    await h.store.append('mission', MID, NO_STREAM, [ev(1)]);
    await h.runtime.fanOutOnce();
    await h.deliveries.claimDue(10, h.clock.now(), 'deadWorker'); // trava e "morre"
    expect((await h.runtime.deliverOnce()).claimed).toBe(0); // travada
    h.clock.advance(6000);
    expect(await h.runtime.recoverOnce()).toBe(1);
    await h.runtime.drainToIdle();
    expect(rec.seen).toHaveLength(1);
    expect(h.metrics.snapshot().recovered).toBe(1);
  });
});

describe('OutboxRuntime — stress e concorrência', () => {
  it('500 eventos × 3 subscribers = 1500 entregas, sem perda e em ordem por stream', async () => {
    const h = harness();
    const s1 = recorder('cqrs');
    const s2 = recorder('notifications');
    const s3 = recorder('learning');
    h.registry.register(s1.sub).register(s2.sub).register(s3.sub);

    const STREAMS = 100;
    const VERS = 5;
    for (let i = 1; i <= STREAMS; i += 1) {
      const sid = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const batch: UncommittedEvent[] = [];
      for (let v = 1; v <= VERS; v += 1) batch.push(ev(v));
      await h.store.append('mission', sid, NO_STREAM, batch);
    }

    await h.runtime.drainToIdle();

    expect(s1.seen).toHaveLength(500);
    expect(s2.seen).toHaveLength(500);
    expect(s3.seen).toHaveLength(500);
    const counts = await h.deliveries.countByStatus();
    expect(counts).toEqual({ pending: 0, delivered: 1500, dead: 0 });

    const sampleId = `00000000-0000-4000-8000-${String(42).padStart(12, '0')}`;
    const sample = s1.seen.filter((x) => x.streamId === sampleId).map((x) => x.version);
    expect(sample).toEqual([1, 2, 3, 4, 5]);
  });

  it('dois workers concorrentes entregam cada evento exatamente uma vez', async () => {
    const h = harness();
    const rec = recorder('cqrs');
    h.registry.register(rec.sub);
    const runtime2 = new OutboxRuntime(
      {
        outbox: h.store,
        deliveries: h.deliveries,
        idempotency: h.idempotency,
        registry: h.registry,
        retryPolicy: new ExponentialBackoffRetryPolicy({ baseMs: 1000, factor: 2, maxMs: 60_000, maxAttempts: 3, jitter: 0 }),
        clock: h.clock,
        metrics: h.metrics,
      },
      { workerId: 'w2', staleLockMs: 5000 },
    );

    for (let i = 1; i <= 40; i += 1) {
      const sid = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      await h.store.append('mission', sid, NO_STREAM, [ev(1), ev(2), ev(3)]);
    }

    for (let round = 0; round < 60; round += 1) {
      await Promise.all([h.runtime.tick(), runtime2.tick()]);
    }

    expect(rec.seen).toHaveLength(120); // 40 streams × 3 versões
    const ids = rec.seen.map((x) => x.id);
    expect(new Set(ids).size).toBe(120); // nenhuma duplicação
    expect((await h.deliveries.countByStatus()).delivered).toBe(120);
  });
});
