// ─────────────────────────────────────────────────────────────────────────────
// R7 — EXECUTAR OPERAÇÃO. Conduz uma Operação em função da Missão via
// `OperationAggregate.conduct` (INV-OP-01/03). Persiste OperationConducted.
// ─────────────────────────────────────────────────────────────────────────────
import { OperationAggregate, OperationId, OperationMissionRef, OperationResponsibleRef } from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class ExecuteOperationUseCase implements MissionUseCase {
  readonly name = 'ExecuteOperation';
  readonly streamType = 'operation';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.missionId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Missão (INV-OP-01)');
    }
    const operationId = this.deps.uuid.next();
    const result = OperationAggregate.conduct({
      id: OperationId.fromUuid(operationId),
      mission: OperationMissionRef.fromString(ctx.identity.missionId),
      conductedBy: OperationResponsibleRef.fromString(this.deps.config.ahriResponsibleId),
      conductedAt: ctx.now,
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      operationId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.missionId),
      { missionId: ctx.identity.missionId },
    );
    return successOutcome(this.name, this.streamType, operationId, appended, {});
  }
}
