// ─────────────────────────────────────────────────────────────────────────────
// AUTONOMOUS BRAIN ADAPTER (GO-LIVE 10E) — o CUTOVER de produção. Implementa o
// port congelado `ExecutiveBrainPort` (o mesmo que a Conversa consome), mas o
// núcleo cognitivo do turno é DELEGADO ao pipeline oficial:
//
//   ConversationRuntime → AutonomousTurnPipeline.processTurn() → Conversa
//
// O FullLoopBrainAdapter (legado) deixa de participar da execução normal. Este
// adapter NÃO reimplementa a cadeia estratégica: chama processTurn (Truth →
// Strategic → Executive Mind → Planner → Mission, já carimbada com decisionId)
// e apenas executa os MESMOS consumidores de produção (outbox, memória viva,
// nota de continuidade, notificação, escalação) e a AUDITORIA do cutover
// (pipeline, correlationId, decisionId, missionId, duração total). A resposta é
// fraseada pela Conversa (comportamento conversacional intocado).
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
  CatalogoDeConhecimento,
  CatalogoDeEstrategias,
} from '@reconstrua/application';
import { AutonomousTurnPipeline, type TurnConversationPort } from './process-turn.js';

interface BrainInput {
  readonly percept: Percept;
  readonly context: ConversationContextView;
}

/** Mapeia a intenção do Brain nas intenções que a Conversa frasea (idêntico ao
 *  contrato consumido pela Conversa; use_case/notification não viram fala). */
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

function toPerceptView(percept: Percept): PerceptView {
  const enrichment = percept.enrichment;
  const artifactCount = enrichment ? enrichment.detectedArtifacts.length : 0;
  return {
    kind: percept.envelope.kind,
    sentiment: enrichment?.sentiment ?? 'unknown',
    urgency: enrichment?.urgency ?? 'unknown',
    hasArtifacts: artifactCount > 0,
    artifactCount,
    silenceMs: percept.envelope.silenceMs,
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

/** Port de conversa do pipeline em produção: NÃO frasea (a Conversa faz isso
 *  depois); apenas captura as intenções do turno. Comportamento conversacional
 *  intocado — o pipeline entrega as intenções, a Conversa as transforma em fala. */
class CaptureConversationPort implements TurnConversationPort {
  respond(): Promise<readonly string[]> {
    return Promise.resolve([]);
  }
}

export interface AutonomousBrainDeps {
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
  readonly strategyCatalog: CatalogoDeEstrategias;
  readonly knowledgeCatalog: CatalogoDeConhecimento;
  readonly clock: Clock;
}

export class AutonomousBrainAdapter implements ExecutiveBrainPort {
  private readonly pipeline: AutonomousTurnPipeline;

  constructor(private readonly deps: AutonomousBrainDeps) {
    this.pipeline = new AutonomousTurnPipeline({
      truth: deps.snapshots,
      rules: deps.rules,
      brain: deps.brain,
      mission: deps.mission,
      conversation: new CaptureConversationPort(),
      strategyCatalog: deps.strategyCatalog,
      knowledgeCatalog: deps.knowledgeCatalog,
      clock: deps.clock,
    });
  }

  async decide(input: BrainInput): Promise<readonly ConversationIntent[]> {
    const d = this.deps;
    const now = d.clock.now();
    const chatId = input.percept.envelope.chatId;
    const t0 = now.getTime();

    // NÚCLEO COGNITIVO — delegado ao pipeline oficial (Truth → Strategic →
    // Executive Mind → Planner → Mission, já carimbada com decisionId em 10C).
    const turn = await this.pipeline.processTurn({
      correlationId: input.percept.id,
      chatId,
      percept: toPerceptView(input.percept),
      missionFacts: toMissionFacts(input.percept),
      memory: toMemoryView(input.context, now),
      context: input.context,
    });

    // CONSUMIDORES de produção (idênticos ao laço legado, na mesma ordem).
    await d.outbox.drainToIdle();
    await d.memoryIngestor.ingestTurn(
      {
        chatId,
        messageId: input.percept.envelope.messageId,
        text: input.percept.envelope.text,
        perceptId: input.percept.id,
        sentiment: input.percept.enrichment?.sentiment ?? 'unknown',
        at: now,
      },
      turn.missionOutcomes,
    );
    if (d.noteWriter) await d.noteWriter.inject(chatId);
    for (const intent of turn.intents) {
      if (intent.kind === 'notification') await d.notification.consume(intent, now);
      else if (intent.kind === 'escalation') await d.handoff.consume(intent);
    }

    // AUDITORIA do cutover: qual pipeline, correlationId, decisionId, missionId,
    // duração total — permitindo reconstruir o atendimento do início ao fim.
    const totalMs = d.clock.now().getTime() - t0;
    d.observability.latency('pipeline', 'autonomous:turn', totalMs, now);
    d.observability.event(
      'pipeline',
      `autonomous corr=${turn.correlationId} decision=${turn.decisionId ?? 'none'} mission=${turn.missionId ?? 'none'} ms=${String(totalMs)}`,
      now,
    );

    // A Conversa frasea as intenções (comportamento conversacional intocado).
    return turn.intents.flatMap(toConversationIntents);
  }
}
