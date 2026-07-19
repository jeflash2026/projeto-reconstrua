// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION BRAIN ADAPTER — liga o Executive Brain REAL (2C) à Conversa (2B) SEM
// tocar em nenhum dos dois. Implementa o port CONGELADO `ExecutiveBrainPort` de 2B:
// monta o BrainContext (percept ESTRUTURADO — nunca o texto —, snapshot, memória,
// regras), chama o Brain determinístico, e PROJETA as intenções do Brain nas
// `ConversationIntent` que a Conversa executa.
//
// Intenções não-conversacionais (use_case/notification) NÃO são faladas: pertencem
// a outros consumidores (UseCaseBus/Notification). O BrainOutcome completo é o
// artefato primário; este adapter é apenas o consumidor da CONVERSA.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type {
  BrainIntent,
  BrainMemoryView,
  ConversationContextView,
  ConversationIntent,
  ExecutiveBrainPort,
  ExecutiveBrainRuntime,
  MissionResolverPort,
  MissionSnapshotPort,
  Percept,
  PerceptView,
  RuleCatalogPort,
} from '@reconstrua/application';
import { emptySnapshot } from '@reconstrua/application';

// BrainInput é o tipo do port congelado de 2B: { percept, context }.
interface BrainInput {
  readonly percept: Percept;
  readonly context: ConversationContextView;
}

/** Percept 2B → visão ESTRUTURADA (sinais), deliberadamente SEM o texto bruto. */
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
    // GO-LIVE 9C: propósito percebido (vocabulário fechado; 'unknown' fail-safe).
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

/** Projeta uma BrainIntent na ConversationIntent (2B) — ou em nada, se não for de conversa. */
function toConversationIntent(intent: BrainIntent): readonly ConversationIntent[] {
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
      // Não são de conversa: outros consumidores as executam.
      return [];
  }
}

export interface ConversationBrainAdapterDeps {
  readonly brain: ExecutiveBrainRuntime;
  readonly snapshots: MissionSnapshotPort;
  readonly rules: RuleCatalogPort;
  readonly resolver: MissionResolverPort;
  readonly clock: Clock;
}

export class ConversationBrainAdapter implements ExecutiveBrainPort {
  constructor(private readonly deps: ConversationBrainAdapterDeps) {}

  async decide(input: BrainInput): Promise<readonly ConversationIntent[]> {
    const chatId = input.percept.envelope.chatId;
    const missionId = await this.deps.resolver.resolve(chatId);
    const snapshot = (await this.deps.snapshots.load(missionId)) ?? emptySnapshot(missionId);
    const now = this.deps.clock.now();
    const rules = await this.deps.rules.all();

    const outcome = await this.deps.brain.decide({
      percept: toPerceptView(input.percept),
      snapshot,
      memory: toMemoryView(input.context, now),
      rules,
      chatId,
      now,
    });

    return outcome.intents.flatMap(toConversationIntent);
  }
}
