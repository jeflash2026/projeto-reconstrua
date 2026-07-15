// ─────────────────────────────────────────────────────────────────────────────
// R6c — ATUALIZAR ETAPA. NUNCA cria Etapa "diretamente": representa EXATAMENTE um
// Estado via `OperationalStageAggregate.represent` (INV-ET-01, 1:1). Persiste
// OperationalStageRepresented. Pré-condição: existe Estado (do passo R6b).
// ─────────────────────────────────────────────────────────────────────────────
import { OperationalStageAggregate, OperationalStageId, RepresentedStateRef } from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class RepresentStageUseCase implements MissionUseCase {
  readonly name = 'RepresentStage';
  readonly streamType = 'operational-stage';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.latestStateId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Estado representado (INV-ET-01)');
    }
    const stageId = this.deps.uuid.next();
    const result = OperationalStageAggregate.represent({
      id: OperationalStageId.fromUuid(stageId),
      representedState: RepresentedStateRef.fromString(ctx.identity.latestStateId),
      form: 'Etapa operacional atual da missão, em forma apresentável ao cliente.',
      presentedAt: ctx.now,
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      stageId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.latestStateId),
      { stateId: ctx.identity.latestStateId },
    );
    return successOutcome(this.name, this.streamType, stageId, appended, { latestStageId: stageId });
  }
}
