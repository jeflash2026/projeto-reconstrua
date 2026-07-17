// ─────────────────────────────────────────────────────────────────────────────
// B4.1 — ENCERRAR MISSÃO. Finaliza OFICIALMENTE o ciclo de vida de um processo.
// NÃO cria Estado "diretamente": deriva EXCLUSIVAMENTE da Verdade Operacional via
// `OperationalStateAggregate.derive` (INV-EO-02), agora com a TERMINALIDADE oficial
// ENCERRADA (Entidade 08 — Estados Terminais; DF-11). Reutiliza integralmente o
// domínio e o molde de R6b (DeriveState): o marco é a mesma derivação, com o estado
// terminal carregado no payload projetado.
//
// O payload projeta `terminalState: 'ENCERRADA'` — é ele que o Read Model de Decisão
// folda para tornar o Estado terminal e, por consequência, ativar RO-STOP-CONCLUDED
// e BLOQUEAR todo acompanhamento recorrente futuro. Compatível com REABERTURA (B4.3):
// o encerramento é um EVENTO append-only; um evento posterior pode revertê-lo sem
// reescrever a história.
// ─────────────────────────────────────────────────────────────────────────────
import { DerivedFromTruthRef, OperationalStateAggregate, OperationalStateId, OperationalStateMissionRef } from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class CloseMissionUseCase implements MissionUseCase {
  readonly name = 'CloseMission';
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
      terminalState: 'ENCERRADA', // terminalidade oficial (DF-11)
      derivedAt: ctx.now,
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const reason = ctx.facts.text !== null && ctx.facts.text.trim() !== '' ? ctx.facts.text.trim() : 'encerramento operacional';
    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      stateId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.latestTruthId),
      { missionId: ctx.identity.missionId, truthId: ctx.identity.latestTruthId, terminalState: 'ENCERRADA', reason },
    );
    return successOutcome(this.name, this.streamType, stateId, appended, { latestStateId: stateId });
  }
}
