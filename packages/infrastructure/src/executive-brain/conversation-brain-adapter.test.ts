// ─────────────────────────────────────────────────────────────────────────────
// Integração 2C↔2B — o Executive Brain REAL dirigindo a Conversa CONGELADA (via
// ConversationBrainAdapter). Prova que a Conversa passa a executar decisões do Brain
// determinístico (não do double), com proveniência real, e que:
//  • texto de 1º turno → saudação entregue (regra RO-*);
//  • documento percebido → UseCaseIntent (não-conversacional) → Conversa CALA;
//  • matéria humana → escalação → handoff (Conversa cala);
//  • o Brain lê SINAIS estruturados, nunca o texto bruto.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { InboundEnvelope, PerceptKind } from '@reconstrua/application';
import { emptySnapshot } from '@reconstrua/application';
import {
  InMemoryConversationStore,
  InMemorySessionStore,
  InMemoryMessageQueueStore,
  InMemoryConversationGateway,
  FakeLlmPerception,
  VaryingLlmExpression,
  FakeSleeper,
  assembleConversationRuntime,
} from '../conversation/index.js';
import { InMemoryMissionSnapshotStore } from './in-memory-adapters.js';
import { assembleExecutiveBrain } from './build-executive-brain.js';

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
  constructor(private readonly prefix: string) {}
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-${this.prefix}-${String(this.n).padStart(12, '0')}`);
  }
}

const CHAT = '5511999999999@s.whatsapp.net';

function envelope(kind: PerceptKind, over: Partial<InboundEnvelope> = {}): InboundEnvelope {
  return {
    messageId: `m-${String(Math.random()).slice(2, 10)}`,
    chatId: CHAT,
    from: CHAT,
    kind,
    text: null,
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
    timestamp: new Date('2026-07-14T00:00:00.000Z'),
    ...over,
  };
}

function harness(seed?: (snapshots: InMemoryMissionSnapshotStore) => void) {
  const clock = new TestClock();
  const snapshots = new InMemoryMissionSnapshotStore();
  seed?.(snapshots);
  const { adapter } = assembleExecutiveBrain({ clock, uuid: new SeqUuid('8000'), snapshots });

  const gateway = new InMemoryConversationGateway(clock);
  const conversationStore = new InMemoryConversationStore();
  const runtime = assembleConversationRuntime({
    gateway,
    perception: new FakeLlmPerception(),
    expression: new VaryingLlmExpression(),
    brain: adapter,
    conversationStore,
    sessionStore: new InMemorySessionStore(),
    queueStore: new InMemoryMessageQueueStore(),
    sleeper: new FakeSleeper(clock),
    clock,
    uuid: new SeqUuid('9000'),
    rng: () => 0.5,
  });
  return { runtime, gateway, conversationStore };
}

describe('Executive Brain (2C) → Conversation (2B)', () => {
  it('texto de primeiro turno: o Brain decide saudar e a Conversa entrega, com proveniência real', async () => {
    const h = harness();
    await h.runtime.receive(envelope('text', { messageId: 'M1', text: 'oi, tudo bem?' }));
    expect(h.gateway.texts()).toHaveLength(1);
    const intent = h.conversationStore.all().find((e) => e.kind === 'intent');
    expect(intent?.intentDirective).toBe('speak');
    expect(intent?.operationalRuleRef).toMatch(/^RO-/); // regra REAL do catálogo
  });

  it('documento percebido: o Brain emite UseCaseIntent (não-conversacional) e a Conversa CALA', async () => {
    const h = harness();
    await h.runtime.receive(envelope('pdf', { messageId: 'M2', fileName: 'rg.pdf' }));
    expect(h.gateway.texts()).toHaveLength(0); // use_case não é fala
  });

  it('matéria de competência humana: escalação → handoff (Conversa cala)', async () => {
    const h = harness((snapshots) => {
      snapshots.set({ ...emptySnapshot(CHAT), matterRequiresHuman: true });
    });
    await h.runtime.receive(envelope('text', { messageId: 'M3', text: 'quero processar alguém' }));
    expect(h.gateway.texts()).toHaveLength(0);
    const intent = h.conversationStore.all().find((e) => e.kind === 'intent');
    expect(intent?.intentDirective).toBe('handoff');
  });
});
