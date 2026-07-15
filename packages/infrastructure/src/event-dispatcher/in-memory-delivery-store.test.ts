// ─────────────────────────────────────────────────────────────────────────────
// Testes do InMemoryDeliveryStore — enqueue idempotente, ordenação FIFO por stream
// (head-of-line), lock, reschedule/backoff, Dead Letter Queue, replay, releaseStale
// (recovery) e contagem por estado.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { StoredEvent } from '@reconstrua/application';
import { InMemoryDeliveryStore } from './in-memory-delivery-store.js';

const NOPROV = { factRef: null, actor: null, decisionType: null, fundamento: null, operationalRuleRef: null };
const NOW = new Date('2026-07-14T00:00:00.000Z');

function event(streamId: string, version: number): StoredEvent {
  return {
    id: `${streamId}-v${String(version)}`,
    streamType: 'mission',
    streamId,
    version,
    eventType: 'thing.happened',
    isRelevant: false,
    payload: { version },
    provenance: NOPROV,
    previousHash: null,
    hash: `h${String(version)}`,
    occurredAt: NOW,
    recordedAt: NOW,
    globalSeq: version,
  };
}

describe('InMemoryDeliveryStore', () => {
  it('enqueue é idempotente por (evento, subscriber)', async () => {
    const s = new InMemoryDeliveryStore();
    await s.enqueue(event('m1', 1), ['cqrs', 'cqrs'], NOW); // subscriber duplicado
    await s.enqueue(event('m1', 1), ['cqrs'], NOW); // chamada duplicada
    expect((await s.countByStatus()).pending).toBe(1);
  });

  it('claimDue entrega apenas a cabeça (menor versão) por stream×subscriber — head-of-line', async () => {
    const s = new InMemoryDeliveryStore();
    await s.enqueue(event('m1', 1), ['cqrs'], NOW);
    await s.enqueue(event('m1', 2), ['cqrs'], NOW);
    const c1 = await s.claimDue(10, NOW, 'w1');
    expect(c1.map((x) => x.delivery.version)).toEqual([1]);
    await s.markDelivered([c1[0]!.delivery.id], NOW);
    const c2 = await s.claimDue(10, NOW, 'w1');
    expect(c2.map((x) => x.delivery.version)).toEqual([2]);
  });

  it('claimDue trava a entrega: um segundo worker não a reivindica', async () => {
    const s = new InMemoryDeliveryStore();
    await s.enqueue(event('m2', 1), ['cqrs'], NOW);
    const c1 = await s.claimDue(10, NOW, 'w1');
    expect(c1).toHaveLength(1);
    const c2 = await s.claimDue(10, NOW, 'w2');
    expect(c2).toHaveLength(0);
  });

  it('reschedule adia a entrega (backoff): não devida agora, devida depois', async () => {
    const s = new InMemoryDeliveryStore();
    await s.enqueue(event('m3', 1), ['cqrs'], NOW);
    const c = await s.claimDue(10, NOW, 'w1');
    const later = new Date(NOW.getTime() + 1000);
    await s.reschedule(c[0]!.delivery.id, later, 1, 'erro');
    expect(await s.claimDue(10, NOW, 'w1')).toHaveLength(0); // não devida
    expect(await s.claimDue(10, later, 'w1')).toHaveLength(1); // devida
  });

  it('deadLetter → listDeadLetters → replay', async () => {
    const s = new InMemoryDeliveryStore();
    await s.enqueue(event('m4', 1), ['cqrs'], NOW);
    const c = await s.claimDue(10, NOW, 'w1');
    await s.deadLetter(c[0]!.delivery.id, 'poison', 3);
    expect((await s.countByStatus()).dead).toBe(1);
    const dl = await s.listDeadLetters(10);
    expect(dl).toHaveLength(1);
    await s.replay(dl[0]!.id, NOW);
    expect((await s.countByStatus()).pending).toBe(1);
    expect((await s.countByStatus()).dead).toBe(0);
  });

  it('releaseStale libera locks de worker morto (recovery)', async () => {
    const s = new InMemoryDeliveryStore();
    await s.enqueue(event('m5', 1), ['cqrs'], NOW);
    await s.claimDue(10, NOW, 'deadWorker'); // trava em NOW
    const threshold = new Date(NOW.getTime() + 5000);
    expect(await s.releaseStale(threshold)).toBe(1);
    expect(await s.claimDue(10, threshold, 'w1')).toHaveLength(1); // reivindicável de novo
  });
});
