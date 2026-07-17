// ─────────────────────────────────────────────────────────────────────────────
// B4.3 — REABRIR MISSÃO. Faz um processo OFICIALMENTE ENCERRADO (B4.1) voltar ao
// estado operacional EM CURSO quando há um fato jurídico legítimo. NÃO cria Estado
// "diretamente": deriva EXCLUSIVAMENTE da Verdade via `OperationalStateAggregate.derive`
// (INV-EO-02), agora SEM terminalidade (estado em curso). Reutiliza o molde de R6b/
// CloseMission e o mesmo Event Store — a reabertura é um EVENTO append-only; a história
// do encerramento permanece íntegra (nada é reescrito nem apagado).
//
// O payload projeta `reopened: true` — é ele que o Read Model de Decisão folda para
// LIMPAR a terminalidade (ENCERRADA → em curso). A partir daí `RO-STOP-CONCLUDED` deixa
// de se aplicar e o acompanhamento recorrente (B4.2) volta a valer. Uma derivação normal
// (sem `reopened`) continua no-op para a decisão — só a reabertura EXPLÍCITA reabre.
// ─────────────────────────────────────────────────────────────────────────────
import { DerivedFromTruthRef, OperationalStateAggregate, OperationalStateId, OperationalStateMissionRef } from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class ReopenMissionUseCase implements MissionUseCase {
  readonly name = 'ReopenMission';
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
      // SEM terminalState: o Estado volta a ser "em curso" (não terminal) — DF-11.
      derivedAt: ctx.now,
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const reason = ctx.facts.text !== null && ctx.facts.text.trim() !== '' ? ctx.facts.text.trim() : 'reabertura operacional';
    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      stateId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.latestTruthId),
      { missionId: ctx.identity.missionId, truthId: ctx.identity.latestTruthId, reopened: true, reason },
    );
    return successOutcome(this.name, this.streamType, stateId, appended, { latestStateId: stateId });
  }
}
