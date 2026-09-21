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
import { revisarFalaEmAnalise } from './sales-conversation-policy.js';
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
  /** AVISO ao operador (2026-09-21, caso Jefferson): situações em que a AHRI
   *  quase deixou o cliente sem resposta viram registro visível — a mesa vê que
   *  aquela conversa precisa de gente. Ausente ⇒ só a nota na memória. */
  readonly alerta?: (chatId: string, motivo: string) => void;
  /** MEDIÇÃO por etapa do turno (2026-09-21, "a AHRI demora ~55s"): sem isto,
   *  só dá para ver o tempo total e a demora fica sem dono. Ausente ⇒ não mede. */
  readonly medir?: (etapa: string, ms: number, chatId: string) => void;
}

export interface TurnResult {
  readonly chatId: string;
  readonly percept: Percept | null;
  readonly intents: readonly ConversationIntent[];
  readonly delivered: readonly DeliveredMessage[];
  readonly skipped: boolean;
}

const MAX_REPHRASE_ATTEMPTS = 3;

/** A saída quando a expressão só sabe repetir: devolve a palavra ao cliente sem
 *  repetir nada e sem prometer nada (caso Jefferson, 2026-09-21). */
const SAIDA_SEM_REPETIR =
  'Tô aqui com você 🙂 Me conta com as suas palavras como você quer seguir, que eu te ajudo daqui.';

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

  /** Mede uma etapa do turno (quando há medidor) sem mudar o que ela faz. */
  private async cronometrar<T>(etapa: string, chatId: string, op: () => Promise<T>): Promise<T> {
    if (this.deps.medir === undefined) return op();
    const t0 = this.deps.clock.now().getTime();
    try {
      return await op();
    } finally {
      this.deps.medir(etapa, this.deps.clock.now().getTime() - t0, chatId);
    }
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
      enrichment = await this.cronometrar('percepcao', envelope.chatId, async () => {
        const recentSummary = await this.recentSummary(envelope.chatId);
        return perception.understand(envelope, { recentSummary });
      });
    }
    const percept: Percept = {
      id: this.deps.uuid.next(),
      envelope,
      enrichment,
      perceivedAt: now,
    };
    await memory.recordPercept(percept);

    // 2) CONTEXTO (read-only).
    const view = await this.cronometrar('contexto', envelope.chatId, () =>
      context.build(envelope.chatId, percept, now, silenceMs),
    );

    // 3) EXECUTIVE BRAIN — a ÚNICA fonte de decisão. A Conversa não cria intenções.
    const intents = await this.cronometrar('decisao', envelope.chatId, () =>
      brain.decide({ percept, context: view }),
    );

    // 3b) CONTEXTO PÓS-DECISÃO (correção GO-LIVE · Jornada Documental Inicial):
    // o pipeline do Brain EXECUTA a missão e drena o dispatcher DENTRO do turno
    // (documento reconhecido → classificação da Jornada 1 → snapshot/pendências
    // atualizados). A FALA precisa enxergar o mundo DEPOIS disso — sem esta
    // reconstrução, a AHRI responde a um documento recém-enviado pedindo o MESMO
    // documento (visão pré-turno). O Brain decidiu com a visão da chegada
    // (correto); a expressão fala com a visão atual (correto).
    const viewParaFala = await this.cronometrar('contexto-pos-decisao', envelope.chatId, () =>
      context.build(envelope.chatId, percept, now, silenceMs),
    );

    // 4) EXECUTA cada intenção (fala com anti-repetição, ou silencia).
    const turnPhrases: string[] = [];
    await this.cronometrar('fala', envelope.chatId, async () => {
      for (const intent of intents) {
        await this.executeIntent(intent, viewParaFala, now, turnPhrases);
      }
    });

    // 5) ENTREGA humana da fila (ordenada, nunca instantânea, nunca sobreposta).
    const delivered = await this.cronometrar('entrega', envelope.chatId, () =>
      this.deps.delivery.drain(viewParaFala),
    );

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
    const bruto = await this.phraseWithoutRepetition(intent, view, turnPhrases);
    // Decreto 2026-07-22 (caso Lucas): guard esgotado ⇒ SILÊNCIO. Repetir a
    // mesma frase pela 3ª vez é a trava robótica que perdeu um cliente real.
    if (bruto === '') return;
    // Rede de segurança (caso Isaú 2026-07-25): em ANÁLISE, cobrança de documento
    // por iniciativa própria (o LLM puxado de volta ao HISCON num follow-up) vira
    // o aviso correto de andamento — nunca informação errada a quem já entregou.
    const text = revisarFalaEmAnalise(bruto, view);
    if (text !== bruto) {
      await memory.recordNote(
        intent.chatId,
        'rede de segurança: cobrança de documento em ANÁLISE substituída por aviso de andamento',
      );
    }
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
    // Degenerado (expressão incapaz de variar) — decreto 2026-07-22 (caso
    // Lucas): se o candidato é LITERALMENTE idêntico a uma fala recente,
    // SILÊNCIO (o eco robótico perdeu um cliente real). Se é apenas similar
    // (paráfrase da mesma intenção), envia — follow-ups legítimos continuam.
    const eco = avoidBase.some((a) => a.trim() === candidate.trim());
    if (eco) {
      // CASO JEFFERSON (2026-09-21): calar era pior que repetir. O cliente
      // escreveu, a AHRI não soube variar e ele ficou sem NENHUMA resposta —
      // do lado dele, abandono. Agora a conversa continua com uma devolução que
      // não repete nada (pede a palavra dele, o que muda o contexto do próximo
      // turno) e o operador é avisado de que aquela conversa precisa de gente.
      await memory.recordNote(
        intent.chatId,
        'guard anti-repetição esgotou tentativas; devolveu a palavra ao cliente (nunca silêncio)',
      );
      this.deps.alerta?.(
        intent.chatId,
        'a AHRI não conseguiu variar a fala; conversa precisa de atenção',
      );
      // Se essa própria devolução já foi dita há pouco, aí sim calar: insistir
      // nela seria a repetição que o decreto proíbe.
      return avoidBase.some((a) => a.trim() === SAIDA_SEM_REPETIR) ? '' : SAIDA_SEM_REPETIR;
    }
    await memory.recordNote(
      intent.chatId,
      'guard anti-repetição esgotou tentativas; enviando fraseado similar (não idêntico)',
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
