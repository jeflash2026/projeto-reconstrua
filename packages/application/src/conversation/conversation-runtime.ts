// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION RUNTIME — o maestro. Executa o FLUXO OBRIGATÓRIO (spec 2B):
//
//   WhatsApp → Perception → Executive Brain → (Use Cases/Event Store: alhures) →
//   Conversation → Resposta WhatsApp
//
// Aqui a Conversa: percebe (LLM de percepção), pede DECISÃO ao Executive Brain
// (única fonte de decisão), e EXECUTA as intenções como linguagem viva e entrega
// humana. NUNCA decide. Estruturalmente NÃO pode alterar Verdade/Estado/Etapa,
// criar Documento nem criar Evento de domínio (não possui ports para isso).
//
// A "vida" (nunca instantâneo, nunca mecânico, nunca repetido) é imposta pela
// humanização (timing/typing/presence/queue) e pelo guard anti-repetição.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { InboundEnvelope, Percept, PerceptEnrichment } from './percept.js';
import { isMechanicalPercept } from './percept.js';
import type { ConversationIntent } from './intent.js';
import { intentSpeaks } from './intent.js';
import { isRepetition } from './phrasing.js';
import type { HumanizationPolicy } from './humanization-policy.js';
import type {
  ConversationContextView,
  ConversationGateway,
  ExecutiveBrainPort,
  LlmExpressionPort,
  LlmPerceptionPort,
} from './ports.js';
import type { SessionRuntime } from './session-runtime.js';
import type { ConversationMemoryRuntime } from './conversation-memory-runtime.js';
import type { ConversationContextRuntime } from './conversation-context-runtime.js';
import type { PromptBuilderRuntime } from './prompt-builder-runtime.js';
import type { MessageQueueRuntime } from './message-queue-runtime.js';
import type { DeliveryRuntime, DeliveredMessage } from './delivery-runtime.js';
import type { SilenceDetectionRuntime } from './silence-detection-runtime.js';

export interface ConversationRuntimeDeps {
  readonly perception: LlmPerceptionPort;
  readonly expression: LlmExpressionPort;
  readonly brain: ExecutiveBrainPort;
  readonly gateway: ConversationGateway;
  readonly sessions: SessionRuntime;
  readonly memory: ConversationMemoryRuntime;
  readonly context: ConversationContextRuntime;
  readonly promptBuilder: PromptBuilderRuntime;
  readonly queue: MessageQueueRuntime;
  readonly delivery: DeliveryRuntime;
  readonly silence: SilenceDetectionRuntime;
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly policy: HumanizationPolicy;
}

export interface TurnResult {
  readonly chatId: string;
  readonly percept: Percept | null;
  readonly intents: readonly ConversationIntent[];
  readonly delivered: readonly DeliveredMessage[];
  readonly skipped: boolean;
}

const MAX_REPHRASE_ATTEMPTS = 3;

export class ConversationRuntime {
  constructor(private readonly deps: ConversationRuntimeDeps) {}

  // ── Entrada real do WhatsApp ────────────────────────────────────────────────
  async receive(envelope: InboundEnvelope): Promise<TurnResult> {
    const { memory, gateway } = this.deps;

    // Idempotência: nunca processar duas vezes a mesma mensagem do provedor.
    if (await memory.alreadySeen(envelope.chatId, envelope.messageId)) {
      return this.skipped(envelope.chatId);
    }

    const now = this.deps.clock.now();
    await this.deps.sessions.touchInbound(envelope.chatId, now);
    await gateway.markRead(envelope.chatId, envelope.messageId);
    await memory.recordInbound(envelope);

    return this.runTurn(envelope, now, envelope.silenceMs);
  }

  // ── Gatilho temporal (silêncio/timeout) — vindo do tick/scheduler ───────────
  async onTemporalTrigger(envelope: InboundEnvelope, now: Date): Promise<TurnResult> {
    await this.deps.memory.recordNote(
      envelope.chatId,
      `sinal temporal percebido: ${envelope.kind} (${String(envelope.silenceMs ?? 0)}ms)`,
    );
    await this.deps.sessions.markSilenceNoticed(envelope.chatId, now);
    return this.runTurn(envelope, now, envelope.silenceMs);
  }

  /**
   * Varre as sessões, detecta silêncio/timeout e roda um turno para cada sinal.
   * A DECISÃO do que fazer é do Brain; aqui só se PERCEBE o silêncio.
   */
  async tick(now: Date = this.deps.clock.now()): Promise<readonly TurnResult[]> {
    const sessions = await this.deps.sessions.all();
    const signals = this.deps.silence.scan(sessions, now);
    const results: TurnResult[] = [];
    for (const signal of signals) {
      results.push(await this.onTemporalTrigger(signal.envelope, now));
    }
    return results;
  }

  // ── Núcleo de um turno: percebe → Brain decide → executa ────────────────────
  private async runTurn(
    envelope: InboundEnvelope,
    now: Date,
    silenceMs: number | null,
  ): Promise<TurnResult> {
    const { perception, memory, context, brain } = this.deps;

    // 1) PERCEPÇÃO — o LLM entende (nunca decide). Percepções mecânicas não passam pelo LLM.
    let enrichment: PerceptEnrichment | null = null;
    if (!isMechanicalPercept(envelope.kind)) {
      const recentSummary = await this.recentSummary(envelope.chatId);
      enrichment = await perception.understand(envelope, { recentSummary });
    }
    const percept: Percept = {
      id: this.deps.uuid.next(),
      envelope,
      enrichment,
      perceivedAt: now,
    };
    await memory.recordPercept(percept);

    // 2) CONTEXTO (read-only).
    const view = await context.build(envelope.chatId, percept, now, silenceMs);

    // 3) EXECUTIVE BRAIN — a ÚNICA fonte de decisão. A Conversa não cria intenções.
    const intents = await brain.decide({ percept, context: view });

    // 4) EXECUTA cada intenção (fala com anti-repetição, ou silencia).
    const turnPhrases: string[] = [];
    for (const intent of intents) {
      await this.executeIntent(intent, view, now, turnPhrases);
    }

    // 5) ENTREGA humana da fila (ordenada, nunca instantânea, nunca sobreposta).
    const delivered = await this.deps.delivery.drain(view);

    return { chatId: envelope.chatId, percept, intents, delivered, skipped: false };
  }

  private async executeIntent(
    intent: ConversationIntent,
    view: ConversationContextView,
    now: Date,
    turnPhrases: string[],
  ): Promise<void> {
    const { memory, sessions, queue } = this.deps;

    // Registra a intenção COM PROVENIÊNCIA (INV-AH-02) antes de agir.
    await memory.recordIntent(intent);

    // Efeitos colaterais de sessão (contexto de runtime — nunca domínio).
    if (intent.directive === 'await_documents') {
      await sessions.setAwaitingDocuments(intent.chatId, true, now);
    } else if (intent.directive === 'stop') {
      await sessions.setStatus(intent.chatId, 'paused', now);
    } else if (intent.directive === 'resume') {
      await sessions.setStatus(intent.chatId, 'active', now);
    }

    if (!intentSpeaks(intent.directive)) {
      // Silêncio ativo / handoff: a Conversa CALA. Só registra a decisão.
      await memory.recordNote(intent.chatId, `intenção silenciosa executada: ${intent.directive}`);
      return;
    }

    // Fraseia (LLM de expressão) com guard anti-repetição.
    const text = await this.phraseWithoutRepetition(intent, view, turnPhrases);
    turnPhrases.push(text);
    await queue.enqueue(intent.chatId, intent.id, text);
  }

  /** Fraseia evitando repetir falas recentes (memória + este turno). Re-tenta se repetir. */
  private async phraseWithoutRepetition(
    intent: ConversationIntent,
    view: ConversationContextView,
    turnPhrases: readonly string[],
  ): Promise<string> {
    const { expression, promptBuilder, policy, memory } = this.deps;
    const avoidBase = [...view.recentOutboundTexts, ...turnPhrases];

    let attempt = 0;
    let avoid = avoidBase;
    let candidate = '';
    while (attempt < MAX_REPHRASE_ATTEMPTS) {
      const request = { ...promptBuilder.build(intent, view), avoidPhrases: avoid };
      candidate = await expression.phrase(request);
      if (!isRepetition(candidate, avoidBase, policy.repetitionThreshold)) {
        return candidate;
      }
      avoid = [...avoid, candidate];
      attempt += 1;
    }
    // Degenerado (LLM incapaz de variar): envia o último, mas deixa rastro auditável.
    await memory.recordNote(
      intent.chatId,
      'guard anti-repetição esgotou tentativas; enviando último fraseado',
    );
    return candidate;
  }

  private async recentSummary(chatId: string): Promise<string | null> {
    const entries = await this.deps.memory.recent(chatId, 5);
    const summaries = entries
      .filter((e) => e.kind === 'percept' && e.text !== null)
      .map((e) => e.text as string);
    return summaries.length > 0 ? summaries.join(' | ') : null;
  }

  private skipped(chatId: string): TurnResult {
    return { chatId, percept: null, intents: [], delivered: [], skipped: true };
  }
}
