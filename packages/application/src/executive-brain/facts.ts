// ─────────────────────────────────────────────────────────────────────────────
// FACTS — os FATOS achatados sobre os quais o Brain decide. Compostos SOMENTE de
// sinais estruturados: natureza do percept, emoção/urgência PERCEBIDAS (sinais, não
// texto), estado/etapa/verdade, pendências, prazos, turno, silêncio.
//
// O Brain NUNCA lê o texto da mensagem — só estes sinais. Isso torna impossível
// "interpretar linguagem" no núcleo de decisão (a interpretação foi da Percepção).
// ─────────────────────────────────────────────────────────────────────────────
import type { Goal, MissionSnapshot } from './mission-snapshot.js';

export type FactValue = string | number | boolean | null | readonly string[];
export type BrainFacts = Readonly<Record<string, FactValue>>;

/** Visão ESTRUTURADA do percept (sem texto bruto) — o Brain não interpreta linguagem. */
export interface PerceptView {
  readonly kind: string; // PerceptKind (texto, áudio, silêncio, timeout, …)
  readonly sentiment: string; // sinal de emoção percebido
  readonly urgency: string; // sinal de urgência percebido
  readonly hasArtifacts: boolean; // artefatos documentais percebidos?
  readonly artifactCount: number;
  readonly silenceMs: number | null;
  /** GO-LIVE 9C: propósito percebido (vocabulário fechado da Percepção). Opcional
   *  — ausente = 'unknown'. Sinal estruturado; o Brain continua sem ler texto. */
  readonly purpose?: string;
}

/** Visão de MEMÓRIA/relacionamento que o Brain lê (contexto, não decisão). */
export interface BrainMemoryView {
  readonly turnCount: number;
  readonly lastOutboundAgoMs: number | null;
}

/** Achata percept + snapshot + memória num mapa de fatos determinístico. */
export function buildFacts(
  percept: PerceptView,
  snapshot: MissionSnapshot,
  memory: BrainMemoryView,
): BrainFacts {
  const minDeadlineDays =
    snapshot.deadlines.length === 0
      ? -1
      : snapshot.deadlines.reduce(
          (min, d) => (d.dueInDays < min ? d.dueInDays : min),
          Number.POSITIVE_INFINITY,
        );

  return {
    perceptKind: percept.kind,
    sentiment: percept.sentiment,
    urgency: percept.urgency,
    hasArtifacts: percept.hasArtifacts,
    artifactCount: percept.artifactCount,
    silenceMs: percept.silenceMs ?? -1,
    isSilence: percept.kind === 'silence' || percept.kind === 'timeout',
    // GO-LIVE 9C: propósito percebido (vocabulário fechado; 'unknown' = fail-safe:
    // sem entendimento, NENHUMA regra operacional pode presumir pedido).
    perceptPurpose: percept.purpose ?? 'unknown',

    stageCode: snapshot.stageCode,
    stateCode: snapshot.stateCode,
    truthEstablished: snapshot.truthEstablished,

    // ── GO-LIVE 9B · TRUTH LAYER → BRAIN FACTS (agnósticos de domínio) ─────────
    // O Planner decide SOMENTE sobre estes fatos; a existência de conversa/sessão/
    // memória/nota JAMAIS participa deles. Fonte: snapshot da missão (read model).
    caseExists: snapshot.caseExists === true,
    caseTruth: snapshot.truthEstablished,
    casePhase:
      snapshot.caseExists !== true
        ? 'sem_caso'
        : snapshot.stateCode === 'ENCERRADA'
          ? 'encerrado'
          : snapshot.truthEstablished
            ? 'em_andamento'
            : 'abertura',

    // ── GO-LIVE 9C · ONBOARDING como eixo próprio (derivado SÓ do domínio) ─────
    // Relacionamento (conversa/sessão/memória/nota) JAMAIS implica onboarding.
    // onboardingExists nasce da missão (vínculo de atendimento no domínio) — que,
    // após 9C, só é criada por pedido percebido (service_request) ou documento.
    onboardingExists: snapshot.caseExists === true && snapshot.stateCode !== 'ENCERRADA',
    onboardingTruth: snapshot.caseExists === true && snapshot.truthEstablished,
    onboardingPhase:
      snapshot.caseExists !== true
        ? 'inexistente'
        : snapshot.stateCode === 'ENCERRADA'
          ? 'encerrado'
          : snapshot.truthEstablished
            ? 'qualificado'
            : 'cadastro',
    pendingDocumentCount: snapshot.pendingDocuments.length,
    hasPendingDocuments: snapshot.pendingDocuments.length > 0,
    hasDeadline: snapshot.deadlines.length > 0,
    minDeadlineDays,
    matterRequiresHuman: snapshot.matterRequiresHuman,
    canonSilent: snapshot.canonSilent,
    awaitingDocuments: snapshot.awaitingDocuments,

    turnCount: memory.turnCount,
    isFirstTurn: memory.turnCount <= 1,
    lastOutboundAgoMs: memory.lastOutboundAgoMs ?? -1,
  };
}

/** Adiciona o objetivo corrente aos fatos (após o GoalSelector). */
export function withGoal(facts: BrainFacts, goal: Goal): BrainFacts {
  return { ...facts, goal };
}
