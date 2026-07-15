// ─────────────────────────────────────────────────────────────────────────────
// ADVOGADO→AHRI BRIDGE — sempre que o advogado conclui uma atividade, a AHRI é
// AUTOMATICAMENTE informada: a atividade vira um PERCEPT estruturado
// (`advogado_<atividade>`) e o EXECUTIVE BRAIN (congelado, determinístico) decide,
// por Regra Operacional, SE e O QUE comunicar ao cliente. O advogado nunca fala com
// o cliente; a ponte não decide nada — só percebe e entrega a decisão do Brain ao
// mensageiro (porta de conversa da AHRI).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { ExecutiveBrainRuntime, OperationalRuleSpec } from '../executive-brain/index.js';
import { emptySnapshot } from '../executive-brain/index.js';
import type { ConversationIntent } from '../conversation/intent.js';
import type { JuridicalEntry } from './juridical-work.js';

/** Porta de entrega: a AHRI fala com o cliente (implementada sobre as peças 2B). */
export interface ClientMessengerPort {
  deliver(intent: ConversationIntent): Promise<void>;
}

export interface BridgeResult {
  readonly informed: true;
  readonly decidedToSpeak: boolean;
  readonly ruleRefs: readonly string[];
}

export interface AhriBridgeDeps {
  readonly brain: ExecutiveBrainRuntime;
  readonly rules: readonly OperationalRuleSpec[];
  readonly messenger: ClientMessengerPort;
  readonly clock: Clock;
  /** Resolve a conversa (chatId) da missão — read model do projector. */
  readonly chatOf: (missionId: string) => string | null;
}

export class AdvogadoAhriBridge {
  constructor(private readonly deps: AhriBridgeDeps) {}

  /** Informa a AHRI sobre a atividade concluída; o Brain decide a comunicação. */
  async notify(entry: JuridicalEntry): Promise<BridgeResult> {
    const now = this.deps.clock.now();
    const chatId = this.deps.chatOf(entry.missionId);

    const outcome = await this.deps.brain.decide({
      percept: {
        kind: `advogado_${entry.kind}`,
        sentiment: 'neutral',
        urgency: entry.kind === 'prazo' ? 'high' : 'normal',
        hasArtifacts: entry.attachmentRef !== null,
        artifactCount: entry.attachmentRef !== null ? 1 : 0,
        silenceMs: null,
      },
      snapshot: emptySnapshot(entry.missionId),
      memory: { turnCount: 2, lastOutboundAgoMs: null },
      rules: this.deps.rules,
      chatId,
      now,
    });

    let spoke = false;
    for (const intent of outcome.intents) {
      if (intent.kind !== 'conversation' || chatId === null) continue;
      const conversationIntent: ConversationIntent = {
        id: intent.id,
        chatId,
        directive: intent.directive,
        speechAct: intent.speechAct,
        topic: intent.topic,
        references: [...intent.references, entry.kind],
        urgency: intent.urgency,
        operationalRuleRef: intent.provenance.operationalRuleRef,
        fundamento: intent.provenance.fundamento,
        timingHintMs: null,
        formedAt: intent.formedAt,
      };
      await this.deps.messenger.deliver(conversationIntent);
      spoke = true;
    }

    return {
      informed: true,
      decidedToSpeak: spoke,
      ruleRefs: outcome.intents.map((i) => i.provenance.operationalRuleRef),
    };
  }
}
