// ─────────────────────────────────────────────────────────────────────────────
// R8 — PRODUZIR PROJEÇÕES. Deriva uma Projeção EXCLUSIVAMENTE da Verdade
// (INV-PJ-01) via `ProjectionAggregate.derive`. A projeção é leitura recalculável —
// evento INFORMATIVO (não altera estado; INV-EV-02). Persiste ProjectionDerived.
// ─────────────────────────────────────────────────────────────────────────────
import { ProjectionAggregate, ProjectionId, ProjectionTruthRef } from '@reconstrua/domain';
import { baseProvenance } from '../provenance.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class ProduceProjectionUseCase implements MissionUseCase {
  readonly name = 'ProduceProjection';
  readonly streamType = 'projection';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.latestTruthId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Verdade de origem (INV-PJ-01)');
    }
    const projectionId = this.deps.uuid.next();
    const result = ProjectionAggregate.derive({
      id: ProjectionId.fromUuid(projectionId),
      derivedFromTruth: ProjectionTruthRef.fromString(ctx.identity.latestTruthId),
      reading: 'Leitura projetada e recalculável da Verdade Operacional atual.',
      calculatedAt: ctx.now,
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      projectionId,
      result.unwrap(),
      false, // Informativo — projeção não altera estado
      baseProvenance(ctx.intent),
      { truthId: ctx.identity.latestTruthId },
    );
    return successOutcome(this.name, this.streamType, projectionId, appended, {});
  }
}
