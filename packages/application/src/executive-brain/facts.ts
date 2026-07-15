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
      : snapshot.deadlines.reduce((min, d) => (d.dueInDays < min ? d.dueInDays : min), Number.POSITIVE_INFINITY);

  return {
    perceptKind: percept.kind,
    sentiment: percept.sentiment,
    urgency: percept.urgency,
    hasArtifacts: percept.hasArtifacts,
    artifactCount: percept.artifactCount,
    silenceMs: percept.silenceMs ?? -1,
    isSilence: percept.kind === 'silence' || percept.kind === 'timeout',

    stageCode: snapshot.stageCode,
    stateCode: snapshot.stateCode,
    truthEstablished: snapshot.truthEstablished,
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
