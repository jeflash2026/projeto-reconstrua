// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTO + PACOTE DE FATOS (PC-R4) — o provider é opcional e BEST-EFFORT:
// presente → casoFatos no contexto; falha → null; ausente → null. A conversa
// NUNCA quebra por causa do pacote.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ConversationContextRuntime } from './conversation-context-runtime.js';
import type { SessionRuntime } from './session-runtime.js';
import type { ConversationMemoryRuntime } from './conversation-memory-runtime.js';
import type { Session } from './ports.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

const SESSION: Session = {
  chatId: 'c1',
  openedAt: NOW,
  lastInboundAt: null,
  lastOutboundAt: null,
  turns: 1,
  presence: 'available',
  awaitingDocuments: false,
  status: 'active',
  lastSilenceNoticeAt: null,
};

function runtimes() {
  const sessions = { getOrOpen: () => Promise.resolve(SESSION) } as unknown as SessionRuntime;
  const memory = {
    recent: () => Promise.resolve([]),
    recentOutboundTexts: () => Promise.resolve([]),
  } as unknown as ConversationMemoryRuntime;
  return { sessions, memory };
}

describe('ConversationContextRuntime · casoFatos (PC-R4)', () => {
  it('provider presente → pacote no contexto', async () => {
    const { sessions, memory } = runtimes();
    const ctx = new ConversationContextRuntime(sessions, memory, {}, () =>
      Promise.resolve('FATOS DO CASO'),
    );
    const view = await ctx.build('c1', null, NOW);
    expect(view.casoFatos).toBe('FATOS DO CASO');
  });

  it('provider que FALHA → null (a conversa nunca quebra)', async () => {
    const { sessions, memory } = runtimes();
    const ctx = new ConversationContextRuntime(sessions, memory, {}, () =>
      Promise.reject(new Error('boom')),
    );
    const view = await ctx.build('c1', null, NOW);
    expect(view.casoFatos).toBeNull();
  });

  it('sem provider → null (comportamento anterior intacto)', async () => {
    const { sessions, memory } = runtimes();
    const ctx = new ConversationContextRuntime(sessions, memory);
    const view = await ctx.build('c1', null, NOW);
    expect(view.casoFatos).toBeNull();
  });
});
