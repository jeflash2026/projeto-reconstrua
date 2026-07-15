// ─────────────────────────────────────────────────────────────────────────────
// R6b — ATUALIZAR ESTADO. NUNCA cria Estado "diretamente": deriva EXCLUSIVAMENTE
// da Verdade Operacional via `OperationalStateAggregate.derive` (INV-EO-02).
// Persiste OperationalStateDerived. Pré-condição: existe Verdade (do passo R6a).
// ─────────────────────────────────────────────────────────────────────────────
import { DerivedFromTruthRef, OperationalStateAggregate, OperationalStateId, OperationalStateMissionRef } from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class DeriveStateUseCase implements MissionUseCase {
  readonly name = 'DeriveState';
  readonly streamType = 'operational-state';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.missionId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Missão (Lei 2)');
    }
    if (ctx.identity.latestTruthId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Verdade de origem (INV-EO-02)');
    }
    const stateId = this.deps.uuid.next();
    const result = OperationalStateAggregate.derive({
      id: OperationalStateId.fromUuid(stateId),
      mission: OperationalStateMissionRef.fromString(ctx.identity.missionId),
      derivedFromTruth: DerivedFromTruthRef.fromString(ctx.identity.latestTruthId),
      derivedAt: ctx.now,
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      stateId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.latestTruthId),
      { missionId: ctx.identity.missionId, truthId: ctx.identity.latestTruthId },
    );
    return successOutcome(this.name, this.streamType, stateId, appended, { latestStateId: stateId });
  }
}
