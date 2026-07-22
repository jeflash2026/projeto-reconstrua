// ─────────────────────────────────────────────────────────────────────────────
// FULL LOOP BRAIN ADAPTER — o coração do GO LIVE. Implementa o port CONGELADO
// `ExecutiveBrainPort` (2B) e, dentro de UM turno, executa o fluxo obrigatório:
//
//   Percepção (2B) → Brain (2C decide) → Mission Runtime (2D executa) →
//   Event Store (2A) → Dispatcher drena (2A.2) → Read Models (2E projeta) →
//   Memória/Relationship (2E lembra) → intenções de conversa → Conversa (2B fala)
//
// As intenções não-conversacionais são consumidas AQUI: use_case→Mission,
// notification→Notification Runtime, escalation→Human Handoff. Nada decide fora do
// Brain; este adapter só ORQUESTRA consumidores. Não altera nenhum módulo congelado.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type {
  BrainIntent,
  BrainMemoryView,
  ConversationContextView,
  ConversationIntent,
  ExecutiveBrainPort,
  ExecutiveBrainRuntime,
  HumanHandoffRuntime,
  MemoryIngestor,
  MemoryNoteWriter,
  MissionFacts,
  MissionRuntime,
  MissionSnapshotPort,
  NotificationRuntime,
  ObservabilityRuntime,
  OutboxRuntime,
  Percept,
  PerceptView,
  RuleCatalogPort,
} from '@reconstrua/application';
import { emptySnapshot } from '@reconstrua/application';
import { toMissionUseCaseIntents } from '../mission-runtime/mission-brain-intents.js';

interface BrainInput {
  readonly percept: Percept;
  readonly context: ConversationContextView;
}

/** Envelope de mídia É artefato POR ESTRUTURA (decreto: a LLM não decide nenhum
 *  passo da jornada). Sem isso, percepção degradada (LLM vazia) zerava os
 *  artefatos e RO-2D-INGEST-DOC nunca disparava — o documento não entrava. */
const KINDS_DOCUMENTAIS: ReadonlySet<string> = new Set(['image', 'pdf', 'document']);

export function toPerceptView(percept: Percept): PerceptView {
  const enrichment = percept.enrichment;
  const daLlm = enrichment ? enrichment.detectedArtifacts.length : 0;
  const artifactCount = KINDS_DOCUMENTAIS.has(percept.envelope.kind) ? Math.max(1, daLlm) : daLlm;
  return {
    kind: percept.envelope.kind,
    sentiment: enrichment?.sentiment ?? 'unknown',
    urgency: enrichment?.urgency ?? 'unknown',
    hasArtifacts: artifactCount > 0,
    artifactCount,
    silenceMs: percept.envelope.silenceMs,
    // GO-LIVE 9C: propósito percebido (vocabulário fechado) — o gate estruturado
    // que separa conversa de pedido de atendimento. Ausente/degrade ⇒ 'unknown'.
    purpose: enrichment?.perceivedPurpose ?? 'unknown',
  };
}

function toMemoryView(context: ConversationContextView, now: Date): BrainMemoryView {
  const lastOut = context.session.lastOutboundAt;
  return {
    turnCount: context.session.turns,
    lastOutboundAgoMs: lastOut ? now.getTime() - lastOut.getTime() : null,
  };
}

function toMissionFacts(percept: Percept): MissionFacts {
  const e = percept.envelope;
  // RFC-0044: monta o PerceivedFact (com proveniência) SE a Percepção o produziu.
  // Optional chaining protege percepts mecânicos (enrichment = null).
  const relevance = percept.enrichment?.perceivedRelevance;
  return {
    chatId: e.chatId,
    senderId: e.from,
    messageId: e.messageId,
    perceptKind: e.kind,
    text: e.text ?? e.editedText,
    mediaRef: e.mediaUrl,
    fileName: e.fileName,
    mimeType: e.mediaMimeType,
    occurredAt: e.timestamp,
    ...(relevance
      ? {
          perceivedRelevance: {
            kind: 'event-relevance' as const,
            value: relevance,
            provenance: {
              perceivedBy: 'perception',
              perceivedAt: percept.perceivedAt,
              evidenceRef: e.messageId,
            },
          },
        }
      : {}),
  };
}

function toConversationIntents(intent: BrainIntent): readonly ConversationIntent[] {
  const common = {
    id: intent.id,
    chatId: intent.chatId ?? '',
    operationalRuleRef: intent.provenance.operationalRuleRef,
    fundamento: intent.provenance.fundamento,
    formedAt: intent.formedAt,
  };
  switch (intent.kind) {
    case 'conversation':
      return [
        {
          ...common,
          directive: intent.directive,
          speechAct: intent.speechAct,
          topic: intent.topic,
          references: intent.references,
          urgency: intent.urgency,
          timingHintMs: null,
        },
      ];
    case 'wait':
      return [
        {
          ...common,
          directive: 'wait',
          speechAct: null,
          topic: null,
          references: [],
          urgency: 'low',
          timingHintMs: intent.untilHintMs,
        },
      ];
    case 'stop':
      return [
        {
          ...common,
          directive: 'stop',
          speechAct: null,
          topic: null,
          references: [intent.reasonCode],
          urgency: 'low',
          timingHintMs: null,
        },
      ];
    case 'escalation':
      return [
        {
          ...common,
          directive: 'handoff',
          speechAct: null,
          topic: null,
          references: [intent.role, intent.reasonCode],
          urgency: 'normal',
          timingHintMs: null,
        },
      ];
    case 'use_case':
    case 'notification':
      return [];
  }
}

export interface FullLoopDeps {
  readonly brain: ExecutiveBrainRuntime;
  readonly rules: RuleCatalogPort;
  readonly snapshots: MissionSnapshotPort;
  readonly mission: MissionRuntime;
  readonly outbox: OutboxRuntime;
  readonly notification: NotificationRuntime;
  readonly handoff: HumanHandoffRuntime;
  readonly memoryIngestor: MemoryIngestor;
  readonly noteWriter: MemoryNoteWriter | null;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
}

/**
 * @deprecated GO-LIVE 10E — LEGADO. O caminho oficial de execução passou a ser o
 * AutonomousTurnPipeline (via AutonomousBrainAdapter). Este adapter permanece
 * apenas para ROLLBACK imediato (GoLiveWiring.pipeline = 'legacy'). Não criar
 * novas dependências sobre ele; não remover ainda.
 */
export class FullLoopBrainAdapter implements ExecutiveBrainPort {
  constructor(private readonly deps: FullLoopDeps) {}

  async decide(input: BrainInput): Promise<readonly ConversationIntent[]> {
    const d = this.deps;
    const now = d.clock.now();
    const chatId = input.percept.envelope.chatId;
    const t0 = now.getTime();

    // 1) BRAIN decide (determinístico, RO-gated).
    const snapshot = (await d.snapshots.load(chatId)) ?? emptySnapshot(chatId);
    const outcome = await d.brain.decide({
      percept: toPerceptView(input.percept),
      snapshot,
      memory: toMemoryView(input.context, now),
      rules: await d.rules.all(),
      chatId,
      now,
    });

    // 2) MISSION executa as intenções use_case (Event Store; append→outbox).
    const missionIntents = toMissionUseCaseIntents(outcome.intents);
    // INSTRUMENTAÇÃO GO-LIVE (2026-07-20): este era o ÚNICO trecho sem rastro —
    // use cases falhando viravam failedOutcome silencioso e o diagnóstico em
    // produção ficou cego. (a) documento SEM nenhuma use_case emitida é anômalo
    // e loga as regras escolhidas; (b) TODO outcome falho loga o erro literal.
    if (
      missionIntents.length === 0 &&
      ['pdf', 'document', 'image'].includes(input.percept.envelope.kind)
    ) {
      d.observability.error(
        'full-loop',
        'documento-sem-use-case',
        now,
        `kind=${input.percept.envelope.kind} chat=${chatId} escolhidas=[${outcome.record.chosenRefs.join(',')}] impedidas=[${outcome.record.impeded.map((i) => `${i.ref}:${i.cause}`).join(',')}]`,
      );
    }
    const missionResult =
      missionIntents.length > 0
        ? await d.mission.execute(toMissionFacts(input.percept), missionIntents)
        : null;
    for (const o of missionResult?.outcomes ?? []) {
      if (!o.ok && !o.skipped) {
        d.observability.error(
          'mission',
          o.useCase,
          now,
          `chat=${chatId} stream=${o.streamType} erro=${o.error ?? 'sem detalhe'}`,
        );
      }
    }

    // 3) DISPATCHER drena: eventos → Read Models / Workflow / projeções.
    await d.outbox.drainToIdle();

    // 4) MEMÓRIA VIVA ingere o turno (com os resultados factuais da missão).
    await d.memoryIngestor.ingestTurn(
      {
        chatId,
        messageId: input.percept.envelope.messageId,
        text: input.percept.envelope.text,
        perceptId: input.percept.id,
        sentiment: input.percept.enrichment?.sentiment ?? 'unknown',
        at: now,
      },
      missionResult?.outcomes ?? [],
    );
    // 5) Continuidade: injeta a nota de memória (contexto dos PRÓXIMOS turnos).
    if (d.noteWriter) await d.noteWriter.inject(chatId);

    // 6) Consumidores das intenções não-conversacionais.
    for (const intent of outcome.intents) {
      if (intent.kind === 'notification') await d.notification.consume(intent, now);
      else if (intent.kind === 'escalation') await d.handoff.consume(intent);
    }

    d.observability.latency('full-loop', 'turn', d.clock.now().getTime() - t0, now);
    d.observability.event('full-loop', `turn:${chatId}`, now);

    // 7) Devolve à Conversa (2B) apenas as intenções de conversa.
    return outcome.intents.flatMap(toConversationIntents);
  }
}
