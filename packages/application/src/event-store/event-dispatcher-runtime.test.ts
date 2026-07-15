// ─────────────────────────────────────────────────────────────────────────────
// Testes do Event Dispatcher Runtime — fan-out, entrega ao-menos-uma-vez,
// publicação tudo-ou-nada, filtro por interesse e idempotência (reentrega).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { EventDispatcherRuntime } from './event-dispatcher-runtime.js';
import type { EventSubscriber, OutboxStore } from './ports.js';
import type { StoredEvent, StoredProvenance } from './stored-event.js';

const NO_PROV: StoredProvenance = {
  factRef: null,
  actor: null,
  decisionType: null,
  fundamento: null,
  operationalRuleRef: null,
};

function evt(id: string, type: string, seq: number): StoredEvent {
  return {
    id,
    streamType: 'mission',
    streamId: 'm1',
    version: seq,
    eventType: type,
    isRelevant: false,
    payload: {},
    provenance: NO_PROV,
    previousHash: null,
    hash: `h${id}`,
    occurredAt: new Date('2026-07-14T00:00:00.000Z'),
    recordedAt: new Date('2026-07-14T00:00:00.000Z'),
    globalSeq: seq,
  };
}

class FakeOutbox implements OutboxStore {
  published = new Set<string>();
  failures = 0;
  constructor(private readonly events: StoredEvent[]) {}
  fetchUnpublished(limit: number): Promise<readonly StoredEvent[]> {
    return Promise.resolve(this.events.filter((e) => !this.published.has(e.id)).slice(0, limit));
  }
  markPublished(ids: readonly string[]): Promise<void> {
    for (const id of ids) this.published.add(id);
    return Promise.resolve();
  }
  recordFailure(ids: readonly string[]): Promise<void> {
    this.failures += ids.length;
    return Promise.resolve();
  }
}

function recorder(name: string, interestedIn?: readonly string[]) {
  const seen: string[] = [];
  const sub: EventSubscriber = {
    name,
    ...(interestedIn ? { interestedIn } : {}),
    handle(e): Promise<void> {
      seen.push(e.id);
      return Promise.resolve();
    },
  };
  return { sub, seen };
}

describe('EventDispatcherRuntime', () => {
  it('faz fan-out para todos os assinantes e publica o lote', async () => {
    const outbox = new FakeOutbox([evt('e1', 'mission.created', 1), evt('e2', 'document.recognized', 2)]);
    const cqrs = recorder('cqrs');
    const notif = recorder('notifications');
    const rt = new EventDispatcherRuntime(outbox).register(cqrs.sub).register(notif.sub);
    const result = await rt.drainOnce();
    expect(result).toEqual({ fetched: 2, published: 2, failed: 0 });
    expect(cqrs.seen).toEqual(['e1', 'e2']);
    expect(notif.seen).toEqual(['e1', 'e2']);
    expect(outbox.published.size).toBe(2);
  });

  it('respeita interestedIn (assinante recebe só os tipos de interesse)', async () => {
    const outbox = new FakeOutbox([evt('e1', 'mission.created', 1), evt('e2', 'document.recognized', 2)]);
    const learning = recorder('learning', ['document.recognized']);
    const rt = new EventDispatcherRuntime(outbox).register(learning.sub);
    await rt.drainOnce();
    expect(learning.seen).toEqual(['e2']);
  });

  it('não publica um evento se algum assinante falhar (tudo-ou-nada) e permite reentrega idempotente', async () => {
    const outbox = new FakeOutbox([evt('e1', 'mission.created', 1)]);
    let attempts = 0;
    const flaky: EventSubscriber = {
      name: 'workflow',
      handle(): Promise<void> {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error('falha transitória'));
        return Promise.resolve();
      },
    };
    const errors: string[] = [];
    const rt = new EventDispatcherRuntime(outbox, {
      onSubscriberError: (s) => errors.push(s),
    }).register(flaky);

    const first = await rt.drainOnce();
    expect(first).toEqual({ fetched: 1, published: 0, failed: 1 });
    expect(outbox.published.size).toBe(0);
    expect(errors).toEqual(['workflow']);

    // Reentrega: o evento continua na outbox e é reprocessado com sucesso.
    const second = await rt.drainOnce();
    expect(second).toEqual({ fetched: 1, published: 1, failed: 0 });
    expect(outbox.published.has('e1')).toBe(true);
  });

  it('drenagem vazia é no-op', async () => {
    const rt = new EventDispatcherRuntime(new FakeOutbox([]));
    expect(await rt.drainOnce()).toEqual({ fetched: 0, published: 0, failed: 0 });
  });
});
