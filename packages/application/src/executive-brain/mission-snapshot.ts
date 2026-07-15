// ─────────────────────────────────────────────────────────────────────────────
// MISSION SNAPSHOT — a leitura (READ MODEL / projeção) que o Brain consome de
// Verdade, Estado e Etapa. É um DTO de LEITURA, não o agregado de domínio: o Brain
// NUNCA lê o Event Store nem instancia entidades (item 12; DF-08). Também NÃO
// altera nada disto — apenas lê para decidir.
//
// `matterRequiresHuman` e `canonSilent` são sinais de COMPETÊNCIA: quando a matéria
// é humana (jurídica/técnica) ou o Canon é silente, o Brain escala (não atua).
// ─────────────────────────────────────────────────────────────────────────────

export interface DeadlineInfo {
  readonly code: string;
  readonly dueInDays: number;
}

export interface MissionSnapshot {
  readonly missionId: string;
  /** Etapa operacional atual (código). */
  readonly stageCode: string;
  /** Estado operacional atual (código). */
  readonly stateCode: string;
  /** A Verdade Operacional já foi sintetizada? */
  readonly truthEstablished: boolean;
  /** Documentos pendentes (códigos), como projetados. */
  readonly pendingDocuments: readonly string[];
  /** Prazos conhecidos. */
  readonly deadlines: readonly DeadlineInfo[];
  /** A matéria exige competência humana (jurídica/técnica) → escalar (DF-09). */
  readonly matterRequiresHuman: boolean;
  /** O Canon é silente sobre a matéria → declarar incerteza e escalar (E10). */
  readonly canonSilent: boolean;
  /** A missão está aguardando documentos do cliente. */
  readonly awaitingDocuments: boolean;
}

/** O objetivo operacional corrente, derivado por GoalSelector de Etapa/Estado/Verdade. */
export type Goal =
  | 'onboard_client'
  | 'collect_documents'
  | 'clarify_facts'
  | 'advance_stage'
  | 'monitor_deadline'
  | 'await_client'
  | 'accompany'
  | 'escalate_to_human'
  | 'conclude';

/** Papéis humanos para escalonamento (Bloco de Papéis do domínio). */
export type HumanRole = 'perito' | 'advogado' | 'operador' | 'supervisor' | 'administrador';

/** Snapshot mínimo default quando não há projeção (missão nova/desconhecida). */
export function emptySnapshot(missionId: string): MissionSnapshot {
  return {
    missionId,
    stageCode: 'ONBOARDING',
    stateCode: 'ABERTA',
    truthEstablished: false,
    pendingDocuments: [],
    deadlines: [],
    matterRequiresHuman: false,
    canonSilent: false,
    awaitingDocuments: false,
  };
}
