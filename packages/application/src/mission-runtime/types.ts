// ─────────────────────────────────────────────────────────────────────────────
// MISSION RUNTIME — tipos centrais. A AHRI passa a EXECUTAR o trabalho: recebe
// intenções do Executive Brain (2C), executa agregados CONGELADOS por fábrica,
// persiste EXCLUSIVAMENTE via Event Store (2A) e publica via Dispatcher (append
// enfileira a outbox atomicamente). Nunca cria Verdade/Estado/Etapa "diretamente":
// sempre pela fábrica (synthesize/derive/represent). Nunca usa LLM. Nunca toca infra.
// ─────────────────────────────────────────────────────────────────────────────
import type { PerceivedFact } from './perceived-fact.js';

/** Fatos PERCEBIDOS (da Perception) que os Use Cases consomem. Não é linguagem
 *  interpretada: são referências factuais (id da mensagem, arquivo, remetente). */
export interface MissionFacts {
  readonly chatId: string;
  readonly senderId: string;
  readonly messageId: string; // evidência primária (rastreabilidade)
  readonly perceptKind: string;
  readonly text: string | null; // legenda/texto — usado só como referência de evidência
  readonly mediaRef: string | null;
  readonly fileName: string | null;
  readonly mimeType: string | null;
  readonly occurredAt: Date;
  /** RFC-0044: fato estruturado percebido (vocabulário fechado, não linguagem) que
   *  acompanha as referências de evidência. Opcional — ausente quando a Percepção
   *  não o produz. */
  readonly perceivedRelevance?: PerceivedFact;
}

/** GO-LIVE 10C — a ORIGEM ESTRATÉGICA de uma missão: a StrategicDecision que o
 *  Executive Mind já deliberou. O Planner NÃO compara/escolhe — apenas carrega
 *  esta origem para a auditoria da missão. Ausente ⇒ fluxo LEGADO (compatível). */
export interface MissionStrategicOrigin {
  readonly decisionId: string;
  readonly strategyRef: string;
  readonly confidence: string;
  readonly decisionReason: string; // o `why` da decisão (por que venceu/perderam)
}

/** A intenção de Use Case vinda EXCLUSIVAMENTE do Executive Brain (com proveniência). */
export interface MissionUseCaseIntent {
  readonly useCase: string;
  readonly references: readonly string[];
  readonly decisor: string; // DECISOR (AHRI)
  readonly tipo: string; // TIPO
  readonly fundamento: string; // FUNDAMENTO
  readonly operationalRuleRef: string; // REGRA OPERACIONAL
  /** GO-LIVE 10C — origem estratégica (Executive Mind). Presente ⇒ novo fluxo. */
  readonly strategicDecision?: MissionStrategicOrigin;
}

/** Identidades conhecidas da conversa/missão — dá idempotência e fluxo de dados
 *  entre passos do pipeline e entre turnos. */
export interface MissionIdentity {
  readonly chatId: string;
  readonly personId: string | null;
  readonly clienteId: string | null;
  readonly missionId: string | null;
  readonly caseId: string | null;
  readonly processId: string | null;
  readonly latestTruthId: string | null;
  readonly latestStateId: string | null;
  readonly latestStageId: string | null;
  readonly lastDocumentId: string | null;
  readonly lastEventId: string | null;
}

export function emptyIdentity(chatId: string): MissionIdentity {
  return {
    chatId,
    personId: null,
    clienteId: null,
    missionId: null,
    caseId: null,
    processId: null,
    latestTruthId: null,
    latestStateId: null,
    latestStageId: null,
    lastDocumentId: null,
    lastEventId: null,
  };
}

/** Aplica um patch de identidade (ids produzidos por um passo) sobre a identidade. */
export function mergeIdentity(
  identity: MissionIdentity,
  patch: Partial<MissionIdentity>,
): MissionIdentity {
  return { ...identity, ...patch, chatId: identity.chatId };
}

/** Resultado da execução de UM Use Case (rastreável). */
export interface UseCaseOutcome {
  readonly useCase: string;
  readonly ok: boolean;
  readonly skipped: boolean; // idempotente: já executado antes
  readonly streamType: string;
  readonly streamId: string | null;
  readonly appended: number;
  readonly eventTypes: readonly string[];
  readonly identityPatch: Partial<MissionIdentity>;
  readonly error: string | null;
}

export function failedOutcome(useCase: string, streamType: string, error: string): UseCaseOutcome {
  return {
    useCase,
    ok: false,
    skipped: false,
    streamType,
    streamId: null,
    appended: 0,
    eventTypes: [],
    identityPatch: {},
    error,
  };
}

export function skippedOutcome(
  useCase: string,
  streamType: string,
  streamId: string,
  patch: Partial<MissionIdentity>,
): UseCaseOutcome {
  return {
    useCase,
    ok: true,
    skipped: true,
    streamType,
    streamId,
    appended: 0,
    eventTypes: [],
    identityPatch: patch,
    error: null,
  };
}

/** Resultado da execução de um turno de missão (uma ou mais intenções). */
export interface MissionResult {
  readonly chatId: string;
  readonly ok: boolean;
  readonly outcomes: readonly UseCaseOutcome[];
  readonly appendedEvents: number;
  readonly identity: MissionIdentity;
}
