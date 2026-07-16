import { describe, it, expect } from 'vitest';
import { InMemoryMediaStore } from './in-memory-media-store.js';

describe('InMemoryMediaStore', () => {
  it('put + has + dedup por sha256', async () => {
    const store = new InMemoryMediaStore();
    const blob = { sha256: 'abc', mime: 'application/pdf', size: 3, bytes: new Uint8Array([1, 2, 3]) };
    expect(await store.has('abc')).toBe(false);
    await store.put(blob);
    expect(await store.has('abc')).toBe(true);
    await store.put(blob); // dedup
    expect(store.count()).toBe(1);
  });

  it('has é false para sha desconhecido', async () => {
    const store = new InMemoryMediaStore();
    expect(await store.has('nao-existe')).toBe(false);
  });
});
