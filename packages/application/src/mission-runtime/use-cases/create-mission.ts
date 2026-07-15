// ─────────────────────────────────────────────────────────────────────────────
// CRIAR MISSÃO (nascimento — flow 1). Executa `Mission.create` com a Pessoa
// beneficiária já reconhecida. Persiste MissionCreated. Idempotente por conversa.
// ─────────────────────────────────────────────────────────────────────────────
import { BeneficiaryPersonRef, InitialOperationalResponsibleRef, Mission, MissionId } from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { skippedOutcome, failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class CreateMissionUseCase implements MissionUseCase {
  readonly name = 'CreateMission';
  readonly streamType = 'mission';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.missionId !== null) {
      return skippedOutcome(this.name, this.streamType, ctx.identity.missionId, { missionId: ctx.identity.missionId });
    }
    if (ctx.identity.personId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Pessoa beneficiária (INV-17)');
    }
    const missionId = this.deps.uuid.next();
    const result = Mission.create({
      id: MissionId.fromUuid(missionId),
      beneficiary: BeneficiaryPersonRef.fromString(ctx.identity.personId),
      initialObjectiveText: 'Acolher o cliente e conduzir a missão desde o primeiro contato.',
      openingReasonText: 'Primeiro contato do cliente via WhatsApp.',
      initialResponsible: InitialOperationalResponsibleRef.fromString(this.deps.config.ahriResponsibleId),
      createdAt: ctx.now,
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      missionId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.personId),
      { beneficiaryPersonId: ctx.identity.personId, clienteId: ctx.identity.clienteId },
    );
    return successOutcome(this.name, this.streamType, missionId, appended, { missionId });
  }
}
