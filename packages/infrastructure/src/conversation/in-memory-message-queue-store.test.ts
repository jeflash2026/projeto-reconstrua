// ─────────────────────────────────────────────────────────────────────────────
// Testes do InMemoryMessageQueueStore — seq monotônico por conversa, FIFO em
// nextPending, markSent e contagem de pendentes. Isolamento entre conversas.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { InMemoryMessageQueueStore } from './in-memory-message-queue-store.js';

const NOW = new Date('2026-07-14T00:00:00.000Z');

describe('InMemoryMessageQueueStore', () => {
  it('atribui seq monotônico por conversa e drena em ordem FIFO', async () => {
    const store = new InMemoryMessageQueueStore();
    const a = await store.enqueue({ id: 'a', chatId: 'c1', intentId: 'i1', text: 'um', enqueuedAt: NOW });
    const b = await store.enqueue({ id: 'b', chatId: 'c1', intentId: 'i2', text: 'dois', enqueuedAt: NOW });
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);

    const first = await store.nextPending('c1');
    expect(first?.id).toBe('a');
    await store.markSent('a');
    const second = await store.nextPending('c1');
    expect(second?.id).toBe('b');
    await store.markSent('b');
    expect(await store.nextPending('c1')).toBeNull();
  });

  it('conta pendentes e isola conversas distintas', async () => {
    const store = new InMemoryMessageQueueStore();
    await store.enqueue({ id: 'a', chatId: 'c1', intentId: 'i1', text: 'x', enqueuedAt: NOW });
    await store.enqueue({ id: 'b', chatId: 'c2', intentId: 'i2', text: 'y', enqueuedAt: NOW });
    expect(await store.pendingCount('c1')).toBe(1);
    expect(await store.pendingCount('c2')).toBe(1);
    const c1 = await store.nextPending('c1');
    expect(c1?.chatId).toBe('c1');
  });
});
