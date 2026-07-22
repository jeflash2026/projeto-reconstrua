// ─────────────────────────────────────────────────────────────────────────────
// REGISTROS LEGADOS de client-memory — causa provada do 500 em /admin/dashboard
// (dist admin-server.js:56:77): registro persistido por build antigo SEM
// `documentsPending` ⇒ undefined.length. O JsonMemoryStore normaliza na fronteira.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { InMemoryJsonStore } from './json-store.js';
import { JsonMemoryStore } from './document-stores.js';

describe('JsonMemoryStore · registro legado sem documentsPending', () => {
  it('load/all normalizam o campo ausente para [] (nunca undefined.length)', async () => {
    const json = new InMemoryJsonStore();
    const store = new JsonMemoryStore(json);

    // Registro como um build ANTIGO gravou: sem documentsPending.
    await json.put('client-memory', 'legado@c.us', {
      chatId: 'legado@c.us',
      attributes: [],
      rememberedEvents: [],
      emotionsObserved: [],
      documentsSent: [],
      stagesCompleted: [],
      conversationStyle: null,
      avgResponseMs: null,
      responseSampleCount: 0,
      lastOutboundAt: null,
      messageCount: 3,
      firstContactAt: null,
      lastContactAt: null,
    });

    const loaded = await store.load('legado@c.us');
    expect(loaded?.documentsPending).toEqual([]);
    expect(loaded?.documentsPending.length).toBe(0); // a expressão exata do dashboard

    const all = await store.all();
    expect(all.every((m) => Array.isArray(m.documentsPending))).toBe(true);

    // Registro moderno permanece intocado.
    await json.put('client-memory', 'novo@c.us', {
      chatId: 'novo@c.us',
      documentsPending: ['CNIS'],
      attributes: [],
      rememberedEvents: [],
      emotionsObserved: [],
      documentsSent: [],
      stagesCompleted: [],
      conversationStyle: null,
      avgResponseMs: null,
      responseSampleCount: 0,
      lastOutboundAt: null,
      messageCount: 1,
      firstContactAt: null,
      lastContactAt: null,
    });
    expect((await store.load('novo@c.us'))?.documentsPending).toEqual(['CNIS']);
  });
});
