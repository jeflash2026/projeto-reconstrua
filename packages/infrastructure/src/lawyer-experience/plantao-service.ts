// ─────────────────────────────────────────────────────────────────────────────
// PLANTÃO SERVICE — monta o Quadro de Plantão do advogado (delta por cursor) e o
// Quadro do Processo (marca visto). Zero cognitive load: entra, entende, decide.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  CursorRuntime,
  DecisionGateRuntime,
  MissionBoard,
  PlantaoBoard,
  ProductivityRuntime,
  TimelineChapter,
} from '@reconstrua/application';
import { buildMissionBoard, buildPlantao, foldTimeline } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { AssembledAdvogadoOperation } from '../advogado-portal/build-advogado-operation.js';

export interface MissionQuadro {
  readonly board: MissionBoard;
  /** Timeline COMPLETA dobrada em capítulos (expansível; nada perdido). */
  readonly fullTimeline: readonly TimelineChapter[];
}

export class PlantaoService {
  constructor(
    private readonly op: AssembledAdvogadoOperation,
    private readonly cursorRuntime: CursorRuntime,
    private readonly gate: DecisionGateRuntime,
    private readonly productivity: ProductivityRuntime,
    private readonly clock: Clock,
  ) {}

  private async missionBoard(advogadoId: string, missionId: string, now: Date): Promise<MissionBoard> {
    const cursor = await this.cursorRuntime.get(advogadoId, now);
    const seenUpTo = this.cursorRuntime.seenUpTo(cursor, missionId);
    const all = this.op.projector.missionTimeline(missionId);
    const newEntries = all.filter((e) => e.globalSeq > seenUpTo);
    const progress = await this.op.workflow.progress(missionId);
    const currentStep = progress?.steps[progress.steps.length - 1] ?? null;
    const awaiting = (await this.gate.awaiting(advogadoId)).filter((d) => d.missionId === missionId);
    const deadlines = (await this.op.work.agenda(advogadoId)).filter((e) => e.missionId === missionId);
    return buildMissionBoard(
      { missionId, currentStep, newEntries, awaiting, deadlines, ahriResolvedCount: 0 },
      now,
    );
  }

  /** O QUADRO DE PLANTÃO — a abertura do dia (≤ 15 segundos de leitura). */
  async plantao(advogadoId: string): Promise<PlantaoBoard> {
    const now = this.clock.now();
    await this.op.projector.refresh();
    await this.cursorRuntime.touchAccess(advogadoId, now);
    await this.productivity.record(advogadoId, 'access', 1, now);

    const assignments = await this.op.work.myMissions(advogadoId);
    const boards: MissionBoard[] = [];
    for (const assignment of assignments) {
      boards.push(await this.missionBoard(advogadoId, assignment.missionId, now));
    }

    const hidden = boards.reduce((sum, b) => sum + b.hiddenEvents, 0);
    const relevant = boards.reduce((sum, b) => sum + b.changes.length, 0);
    if (hidden > 0) await this.productivity.record(advogadoId, 'events_hidden', hidden, now);
    if (relevant > 0) await this.productivity.record(advogadoId, 'relevant_changes', relevant, now);

    const ahriComms = (await this.productivity.report(advogadoId)).ahriCommunications;
    return buildPlantao(advogadoId, boards, ahriComms, now);
  }

  /** O QUADRO DO PROCESSO — abre, entende, e o cursor marca visto. */
  async quadro(advogadoId: string, missionId: string): Promise<MissionQuadro | null> {
    const now = this.clock.now();
    if (!(await this.op.work.isAssigned(advogadoId, missionId))) return null;
    await this.op.projector.refresh();
    const board = await this.missionBoard(advogadoId, missionId, now);
    const all = this.op.projector.missionTimeline(missionId);
    const maxSeq = all.reduce((max, e) => Math.max(max, e.globalSeq), 0);
    await this.cursorRuntime.markSeen(advogadoId, missionId, maxSeq, now);
    return { board, fullTimeline: foldTimeline(all) };
  }
}
