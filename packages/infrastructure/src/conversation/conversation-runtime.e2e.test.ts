// ─────────────────────────────────────────────────────────────────────────────
// E2E do CONVERSATION RUNTIME — o fluxo obrigatório ponta a ponta com adapters em
// memória. Prova as garantias da spec 2B:
//  • fluxo completo (percebe → Brain decide → frasea → entrega humana);
//  • NUNCA instantâneo (sempre houve espera + "digitando" antes de enviar);
//  • NUNCA sobreposto e em ordem (fila FIFO por conversa);
//  • NUNCA repete frases (guard anti-repetição, inclusive contra LLM teimoso);
//  • idempotência (mesma mensagem 2× → 1 entrega);
//  • a Conversa NÃO decide (Brain vazio → nenhuma fala);
//  • proveniência registrada (INV-AH-02);
//  • as doze naturezas de entrada percebidas;
//  • fronteira: memória só guarda log de integração (nunca evento de domínio).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type {
  BrainInput,
  ConversationIntent,
  ExecutiveBrainPort,
  HumanizationPolicy,
  InboundEnvelope,
  LlmExpressionPort,
  PerceptKind,
} from '@reconstrua/application';
import { DEFAULT_HUMANIZATION_POLICY, isRepetition } from '@reconstrua/application';
import { InMemoryConversationStore } from './in-memory-conversation-store.js';
import { InMemorySessionStore } from './in-memory-session-store.js';
import { InMemoryMessageQueueStore } from './in-memory-message-queue-store.js';
import { InMemoryConversationGateway } from './in-memory-conversation-gateway.js';
import { FakeLlmPerception, VaryingLlmExpression } from './fake-llm.js';
import { DeterministicExecutiveBrain } from './deterministic-executive-brain.js';
import { FakeSleeper } from './system-sleeper.js';
import { assembleConversationRuntime, type ConversationWiring } from './build-conversation-runtime.js';

class TestClock implements Clock {
  constructor(private t: Date) {}
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

function harness(over: Partial<ConversationWiring> = {}) {
  const clock = new TestClock(new Date('2026-07-14T00:00:00.000Z'));
  const sleeper = new FakeSleeper(clock);
  const uuid = new SeqUuid();
  const gateway = new InMemoryConversationGateway(clock);
  const conversationStore = new InMemoryConversationStore();
  const sessionStore = new InMemorySessionStore();
  const queueStore = new InMemoryMessageQueueStore();
  const runtime = assembleConversationRuntime({
    gateway,
    perception: new FakeLlmPerception(),
    expression: new VaryingLlmExpression(),
    brain: new DeterministicExecutiveBrain(clock, uuid),
    conversationStore,
    sessionStore,
    queueStore,
    sleeper,
    clock,
    uuid,
    rng: () => 0.5,
    ...over,
  });
  return { runtime, clock, sleeper, gateway, conversationStore, sessionStore, uuid };
}

describe('ConversationRuntime — fluxo completo e humanização', () => {
  it('percebe → Brain decide → frasea → entrega, e NUNCA instantaneamente', async () => {
    const h = harness();
    const result = await h.runtime.receive(envelope('text', { messageId: 'M1', text: 'oi, tudo bem?' }));

    expect(result.skipped).toBe(false);
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]?.directive).toBe('speak');
    expect(result.delivered).toHaveLength(1);
    expect(h.gateway.texts()).toHaveLength(1);

    // NUNCA instantâneo: houve espera antes do envio (>= piso).
    expect(h.sleeper.total()).toBeGreaterThanOrEqual(DEFAULT_HUMANIZATION_POLICY.minPreSendMs);

    // Sequência humana: leu, mostrou "digitando" e só então enviou.
    const actions = h.gateway.actions();
    const textIdx = actions.findIndex((a) => a.type === 'text');
    const beforeText = actions.slice(0, textIdx);
    expect(beforeText.some((a) => a.type === 'read')).toBe(true);
    expect(beforeText.some((a) => a.type === 'presence' && a.state === 'composing')).toBe(true);
  });

  it('registra a INTENÇÃO com proveniência (INV-AH-02)', async () => {
    const h = harness();
    await h.runtime.receive(envelope('text', { messageId: 'M1', text: 'olá' }));
    const intentEntry = h.conversationStore.all().find((e) => e.kind === 'intent');
    expect(intentEntry?.operationalRuleRef).toBe('RO-REF-2B-DOUBLE');
    expect(intentEntry?.intentDirective).toBe('speak');
  });

  it('é IDEMPOTENTE: a mesma mensagem processa uma única vez', async () => {
    const h = harness();
    const env = envelope('text', { messageId: 'DUP', text: 'oi' });
    const first = await h.runtime.receive(env);
    const second = await h.runtime.receive(env);
    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
    expect(h.gateway.texts()).toHaveLength(1);
  });

  it('a Conversa NÃO decide: com Brain vazio, nenhuma fala sai', async () => {
    const nullBrain: ExecutiveBrainPort = { decide: () => Promise.resolve([]) };
    const h = harness({ brain: nullBrain });
    const result = await h.runtime.receive(envelope('text', { messageId: 'M1', text: 'preciso muito de ajuda urgente' }));
    expect(result.intents).toHaveLength(0);
    expect(result.delivered).toHaveLength(0);
    expect(h.gateway.texts()).toHaveLength(0);
  });

  it('fronteira: a memória só guarda log de integração, nunca evento de domínio', async () => {
    const h = harness();
    await h.runtime.receive(envelope('text', { messageId: 'M1', text: 'oi' }));
    const kinds = new Set(h.conversationStore.all().map((e) => e.kind));
    for (const k of kinds) {
      expect(['inbound', 'percept', 'intent', 'outbound', 'note']).toContain(k);
    }
  });
});

describe('ConversationRuntime — nunca repetir frases', () => {
  it('em muitos turnos, nenhuma fala repete outra dentro da janela anti-repetição', async () => {
    const h = harness();
    const texts: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      // turno > 1 → intenção genérica "explain"; força variedade real.
      await h.runtime.receive(envelope('text', { messageId: `T${String(i)}`, text: `mensagem número ${String(i)}` }));
      const all = h.gateway.texts();
      texts.push(all[all.length - 1] ?? '');
    }
    // Nenhuma fala repete as anteriores dentro da janela de 8.
    const window = DEFAULT_HUMANIZATION_POLICY.antiRepetitionWindow;
    for (let i = 0; i < texts.length; i += 1) {
      const prev = texts.slice(Math.max(0, i - window), i);
      expect(isRepetition(texts[i] ?? '', prev, DEFAULT_HUMANIZATION_POLICY.repetitionThreshold)).toBe(false);
    }
  });

  it('contra um LLM teimoso (sempre igual), o guard esgota tentativas e deixa rastro auditável', async () => {
    const stubborn: LlmExpressionPort = { phrase: () => Promise.resolve('a mesma frase de sempre') };
    const h = harness({ expression: stubborn });
    await h.runtime.receive(envelope('text', { messageId: 'A', text: 'primeira' }));
    await h.runtime.receive(envelope('text', { messageId: 'B', text: 'segunda' }));
    const notes = h.conversationStore.all().filter((e) => e.kind === 'note' && (e.text ?? '').includes('anti-repetição'));
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ConversationRuntime — ordem e não-sobreposição (fila)', () => {
  it('duas intenções faladas viram duas mensagens, em ordem, com "digitando" antes de cada', async () => {
    const clock = new TestClock(new Date('2026-07-14T00:00:00.000Z'));
    const uuid = new SeqUuid();
    const twoSpeak: ExecutiveBrainPort = {
      decide: (input: BrainInput): Promise<readonly ConversationIntent[]> => {
        const mk = (topic: string): ConversationIntent => ({
          id: uuid.next(),
          chatId: input.percept.envelope.chatId,
          directive: 'speak',
          speechAct: 'inform',
          topic,
          references: [],
          urgency: 'normal',
          operationalRuleRef: 'RO-REF-2B-DOUBLE',
          fundamento: 'teste',
          timingHintMs: null,
          formedAt: clock.now(),
        });
        return Promise.resolve([mk('primeiro ponto'), mk('segundo ponto')]);
      },
    };
    const h = harness({ brain: twoSpeak });
    const result = await h.runtime.receive(envelope('text', { messageId: 'M1', text: 'me explica duas coisas' }));

    expect(result.delivered).toHaveLength(2);
    const actions = h.gateway.actions();
    const textIdxs = actions.map((a, i) => (a.type === 'text' ? i : -1)).filter((i) => i >= 0);
    expect(textIdxs).toHaveLength(2);
    // Entre a 1ª e a 2ª mensagem houve nova encenação de "digitando" (não sobreposição).
    const between = actions.slice(textIdxs[0], textIdxs[1]);
    expect(between.some((a) => a.type === 'presence' && a.state === 'composing')).toBe(true);
  });
});

describe('ConversationRuntime — silêncio, timeout e as doze naturezas', () => {
  it('detecta silêncio e roda um turno (cobra); timeout apenas acompanha (cala)', async () => {
    const policy: HumanizationPolicy = {
      ...DEFAULT_HUMANIZATION_POLICY,
      silenceThresholdMs: 1_000,
      timeoutThresholdMs: 10_000,
    };
    const h = harness({ policy });
    await h.runtime.receive(envelope('text', { messageId: 'M1', text: 'oi' }));
    const textsAfterHello = h.gateway.texts().length;

    // Silêncio: avança além do limiar de silêncio, aquém do timeout.
    h.clock.advance(2_000);
    const silenceResults = await h.runtime.tick();
    expect(silenceResults).toHaveLength(1);
    expect(silenceResults[0]?.intents[0]?.directive).toBe('insist');
    expect(h.gateway.texts().length).toBeGreaterThan(textsAfterHello);

    // Timeout: avança muito além → 'accompany' (silencioso), nenhuma nova fala.
    const textsBeforeTimeout = h.gateway.texts().length;
    h.clock.advance(20_000);
    const timeoutResults = await h.runtime.tick();
    expect(timeoutResults[0]?.intents[0]?.directive).toBe('accompany');
    expect(h.gateway.texts().length).toBe(textsBeforeTimeout);
  });

  it('percebe todas as doze naturezas sem quebrar; falantes falam, silenciosas calam', async () => {
    const speaking: PerceptKind[] = ['text', 'image', 'pdf', 'document', 'audio', 'location', 'contact', 'edit'];
    const silent: PerceptKind[] = ['reaction', 'delete', 'timeout'];

    for (const kind of speaking) {
      const h = harness();
      const over =
        kind === 'text'
          ? { text: 'preciso enviar um documento' }
          : kind === 'edit'
            ? { editedText: 'corrigido' }
            : kind === 'pdf' || kind === 'document'
              ? { fileName: 'arquivo' }
              : {};
      await h.runtime.receive(envelope(kind, { messageId: `k-${kind}`, ...over }));
      expect(h.gateway.texts().length, `esperava fala para ${kind}`).toBe(1);
    }

    for (const kind of silent) {
      const h = harness();
      if (kind === 'timeout') {
        await h.runtime.onTemporalTrigger(
          envelope('timeout', { messageId: 't', silenceMs: 999_999 }),
          h.clock.now(),
        );
      } else {
        await h.runtime.receive(envelope(kind, { messageId: `k-${kind}` }));
      }
      expect(h.gateway.texts().length, `esperava silêncio para ${kind}`).toBe(0);
    }
  });

  it('silence: percept mecânico não chama o LLM de percepção (enrichment nulo)', async () => {
    const h = harness();
    const result = await h.runtime.onTemporalTrigger(
      envelope('silence', { messageId: 's', silenceMs: 60_000 }),
      h.clock.now(),
    );
    expect(result.percept?.enrichment).toBeNull();
  });
});
