// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Angela (11 95707-5533, 24/09/2026) — o dono, vendo o atendimento:
// "a AHRI virou psicóloga, interrogadora". Com o DOSSIÊ já entregue e o guard
// anti-repetição esgotado, a última rede dizia "me conta com as suas palavras
// como você quer seguir" — voz de consultório para quem só precisava responder
// SIM. Quem já recebeu a análise tem UM passo pendente, e ele tem nome.
// ─────────────────────────────────────────────────────────────────────────────
import { it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import { ConversationRuntime } from './conversation-runtime.js';
import { ConversationContextRuntime } from './conversation-context-runtime.js';
import { PromptBuilderRuntime } from './prompt-builder-runtime.js';
import { DEFAULT_HUMANIZATION_POLICY } from './humanization-policy.js';
import type { ConversationIntent } from './intent.js';
import type { SessionRuntime } from './session-runtime.js';
import type { ConversationMemoryRuntime } from './conversation-memory-runtime.js';

const NOW = new Date('2026-09-24T21:14:00.000Z');
const CHAT = '5511957075533@s.whatsapp.net';
class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

it('dossiê entregue + expressão teimosa ⇒ a última rede pede o SIM, não faz terapia', async () => {
  const TEIMOSA = 'a mesma frase de sempre';
  const sessions = {
    getOrOpen: () =>
      Promise.resolve({ chatId: CHAT, turns: 9, lastInboundAt: null, lastOutboundAt: null }),
    touchInbound: () => Promise.resolve(),
  } as unknown as SessionRuntime;
  const memory = {
    alreadySeen: () => Promise.resolve(false),
    recordInbound: () => Promise.resolve(),
    recordPercept: () => Promise.resolve(),
    recordIntent: () => Promise.resolve(),
    recordNote: () => Promise.resolve(),
    recent: () => Promise.resolve([]),
    // A fala teimosa JÁ foi dita — é o eco que dispara a última rede.
    recentOutboundTexts: () => Promise.resolve([TEIMOSA]),
  } as unknown as ConversationMemoryRuntime;

  const context = new ConversationContextRuntime(
    sessions,
    memory,
    {},
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    () => Promise.resolve(true), // o dossiê JÁ está com a cliente
  );

  const intent: ConversationIntent = {
    id: 'i1',
    chatId: CHAT,
    directive: 'speak',
    speechAct: 'inform',
    topic: 'confirmação',
    references: [],
    urgency: 'normal',
    operationalRuleRef: 'RO-X',
    fundamento: 'f',
    timingHintMs: null,
    formedAt: NOW,
  };

  const enfileiradas: string[] = [];
  const runtime = new ConversationRuntime({
    perception: {
      understand: () =>
        Promise.resolve({ perceivedPurpose: 'service_request', sentiment: 'neutral' } as never),
    },
    expression: { phrase: () => Promise.resolve(TEIMOSA) },
    brain: { decide: () => Promise.resolve([intent]) },
    gateway: { markRead: () => Promise.resolve() } as never,
    sessions,
    memory,
    context,
    promptBuilder: new PromptBuilderRuntime(8),
    queue: {
      enqueue: (_c: string, _i: string, texto: string) => {
        enfileiradas.push(texto);
        return Promise.resolve();
      },
    } as never,
    delivery: { drain: () => Promise.resolve([]) } as never,
    silence: {} as never,
    clock: new TestClock(),
    uuid: new SeqUuid(),
    policy: DEFAULT_HUMANIZATION_POLICY,
  });

  await runtime.receive({
    messageId: 'M-sim',
    chatId: CHAT,
    from: CHAT,
    kind: 'text',
    text: 'Segue comigo',
    mediaUrl: null,
    mediaMimeType: null,
    fileName: null,
    location: null,
    contact: null,
    reactionEmoji: null,
    reactionToMessageId: null,
    editedText: null,
    deletedMessageId: null,
    silenceMs: null,
    timestamp: NOW,
  });

  expect(enfileiradas).toHaveLength(1);
  expect(enfileiradas[0]).toContain('preciso só do seu SIM');
  expect(enfileiradas[0]).not.toMatch(/com as suas palavras|o que está acontecendo/iu);
});
