// ─────────────────────────────────────────────────────────────────────────────
// QUADRO DE PLANTÃO — a abertura do dia: ONDE ESTOU · O QUE MUDOU · O QUE ESPERA
// MINHA DECISÃO. Composição DETERMINÍSTICA de read models (delta por cursor,
// dobra da timeline, decisões abertas, prazos) com orçamento duro de itens e
// ZERO-ESTADO honesto ("nada mudou; nenhuma ação sua"). O resumo executivo é
// composição de FATOS (padrão 2E) — nenhum LLM decide nada aqui.
// ─────────────────────────────────────────────────────────────────────────────
import type { TimelineEntry } from '../admin-portal/timeline-projector.js';
import type { JuridicalEntry } from '../advogado-portal/juridical-work.js';
import type { DecisionRequest } from './decision-gate.js';
import { foldTimeline, hiddenCount, type TimelineChapter } from './smart-timeline.js';

/** Prioridade da fila — política operacional determinística, citável (RO-3D-PRIORITY). */
export const PRIORITY_RULE_REF = 'RO-3D-PRIORITY-001';

export interface MissionBoard {
  readonly missionId: string;
  /** ONDE ESTOU (1 linha). */
  readonly whereAmI: string;
  /** O QUE MUDOU desde o cursor (dobrado; máx. 3 grupos relevantes). */
  readonly changes: readonly TimelineChapter[];
  /** O QUE ESPERA MINHA DECISÃO (máx. 3). */
  readonly awaiting: readonly DecisionRequest[];
  /** Prazos abertos (do próprio advogado). */
  readonly deadlines: readonly JuridicalEntry[];
  /** Nada mudou e nada espera? (zero-estado) */
  readonly quiet: boolean;
  /** Métrica: eventos novos crus × grupos mostrados. */
  readonly rawNewEvents: number;
  readonly hiddenEvents: number;
  /** Motivo da posição na fila (auditável). */
  readonly priorityReason: string;
  readonly priorityScore: number;
}

export interface PlantaoBoard {
  readonly advogadoId: string;
  readonly generatedAt: Date;
  /** Fila ordenada por prioridade (motivo em cada missão). */
  readonly missions: readonly MissionBoard[];
  /** Quantas missões estão quietas (uma linha só; não roubam atenção). */
  readonly quietCount: number;
  /** Resumo executivo — FATOS compostos, sem LLM. */
  readonly executiveSummary: readonly string[];
}

export interface MissionInputs {
  readonly missionId: string;
  readonly currentStep: string | null;
  readonly newEntries: readonly TimelineEntry[]; // já filtradas por cursor
  readonly awaiting: readonly DecisionRequest[];
  readonly deadlines: readonly JuridicalEntry[];
  readonly ahriResolvedCount: number; // comunicações/cobranças feitas pela AHRI
}

const MAX_CHANGES = 3;
const MAX_AWAITING = 3;

function priorityOf(m: MissionInputs, now: Date): { score: number; reason: string } {
  const nextDue = m.deadlines
    .map((d) => d.dueAt?.getTime() ?? Number.POSITIVE_INFINITY)
    .reduce((min, t) => Math.min(min, t), Number.POSITIVE_INFINITY);
  if (nextDue < now.getTime()) return { score: 1000, reason: 'prazo VENCIDO' };
  if (nextDue - now.getTime() <= 3 * 24 * 60 * 60_000) return { score: 900, reason: 'prazo em ≤ 3 dias' };
  if (m.awaiting.length > 0) return { score: 700, reason: 'aguarda sua decisão' };
  if (m.newEntries.some((e) => e.isRelevant)) return { score: 500, reason: 'mudanças relevantes novas' };
  return { score: 0, reason: 'sem novidade' };
}

export function buildMissionBoard(m: MissionInputs, now: Date): MissionBoard {
  const relevantNew = m.newEntries.filter((e) => e.isRelevant);
  const chapters = foldTimeline(relevantNew).slice(0, MAX_CHANGES);
  const priority = priorityOf(m, now);
  const quiet = chapters.length === 0 && m.awaiting.length === 0 && m.deadlines.length === 0;
  return {
    missionId: m.missionId,
    whereAmI: m.currentStep !== null ? `Etapa: ${m.currentStep}` : 'Etapa: início',
    changes: chapters,
    awaiting: m.awaiting.slice(0, MAX_AWAITING),
    deadlines: m.deadlines,
    quiet,
    rawNewEvents: m.newEntries.length,
    hiddenEvents: hiddenCount(relevantNew, chapters) + (m.newEntries.length - relevantNew.length),
    priorityReason: `${priority.reason} (${PRIORITY_RULE_REF})`,
    priorityScore: priority.score,
  };
}

export function buildPlantao(advogadoId: string, boards: readonly MissionBoard[], ahriComms: number, now: Date): PlantaoBoard {
  const ordered = [...boards].sort((a, b) => b.priorityScore - a.priorityScore || a.missionId.localeCompare(b.missionId));
  const active = ordered.filter((b) => !b.quiet);
  const quietCount = ordered.length - active.length;
  const totalNew = ordered.reduce((sum, b) => sum + b.rawNewEvents, 0);
  const awaiting = ordered.reduce((sum, b) => sum + b.awaiting.length, 0);
  const overdue = ordered.filter((b) => b.priorityReason.startsWith('prazo VENCIDO')).length;

  const executiveSummary: string[] = [
    `O que aconteceu: ${String(totalNew)} evento(s) novo(s) em ${String(active.length)} processo(s).`,
    `O que exige sua decisão: ${String(awaiting)} pedido(s) de confirmação${overdue > 0 ? `; ${String(overdue)} prazo(s) VENCIDO(s)` : ''}.`,
    `O que pode esperar: ${String(quietCount)} processo(s) sem novidade — nenhuma ação sua é necessária.`,
    `O que a AHRI já resolveu: ${String(ahriComms)} comunicação(ões) com clientes desde sua última visita.`,
  ];

  return { advogadoId, generatedAt: now, missions: ordered, quietCount, executiveSummary };
}
