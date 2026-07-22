// ─────────────────────────────────────────────────────────────────────────────
// Teste HTTP do webhook da Evolution → Conversation Runtime (via Fastify.inject,
// sem abrir porta). Prova o caminho completo: POST webhook → mapeia → percebe →
// Brain decide → frasea → entrega no gateway.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import {
  InMemoryConversationStore,
  InMemorySessionStore,
  InMemoryMessageQueueStore,
  InMemoryConversationGateway,
  FakeLlmPerception,
  VaryingLlmExpression,
  DeterministicExecutiveBrain,
  FakeSleeper,
  assembleConversationRuntime,
} from '@reconstrua/infrastructure';
import { buildServer } from './server.js';

class TestClock implements Clock {
  private t = new Date('2026-07-14T00:00:00.000Z');
  now(): Date {
    return new Date(this.t.getTime());
  }
  advance(ms: number): void {
    this.t = new Date(this.t.getTime() + ms);
  }
}

class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

function harness() {
  const clock = new TestClock();
  const uuid = new SeqUuid();
  const gateway = new InMemoryConversationGateway(clock);
  const runtime = assembleConversationRuntime({
    gateway,
    perception: new FakeLlmPerception(),
    expression: new VaryingLlmExpression(),
    brain: new DeterministicExecutiveBrain(clock, uuid),
    conversationStore: new InMemoryConversationStore(),
    sessionStore: new InMemorySessionStore(),
    queueStore: new InMemoryMessageQueueStore(),
    sleeper: new FakeSleeper(clock),
    clock,
    uuid,
    rng: () => 0.5,
  });
  return { runtime, gateway };
}

function upsert(text: string): Record<string, unknown> {
  return {
    event: 'messages.upsert',
    instance: 'ahri',
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'W1' },
      message: { conversation: text },
      messageTimestamp: 1_760_000_000,
    },
  };
}

describe('POST /webhook/evolution', () => {
  it('processa um texto e entrega uma resposta viva', async () => {
    const h = harness();
    const app = buildServer({ runtime: h.runtime, awaitProcessing: true });

    const response = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      payload: upsert('oi, preciso de ajuda'),
    });

    expect(response.statusCode).toBe(200);
    const body: { ok: boolean; processed: boolean; chatId: string | null } = response.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(true);
    expect(body.chatId).toBe('5511999999999@s.whatsapp.net');
    expect(h.gateway.texts()).toHaveLength(1);
    await app.close();
  });

  it('payload irreconhecível → 200 (ack) e não processa', async () => {
    const h = harness();
    const app = buildServer({ runtime: h.runtime, awaitProcessing: true });

    const response = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      payload: { foo: 'bar' },
    });

    expect(response.statusCode).toBe(200);
    const parsed: { processed: boolean } = response.json();
    expect(parsed.processed).toBe(false);
    expect(h.gateway.texts()).toHaveLength(0);
    await app.close();
  });
});
