// ─────────────────────────────────────────────────────────────────────────────
// R2 — RECONHECER CLIENTE. Condição da Pessoa já reconhecida (INV-CL-01). Executa
// `ClienteAggregate.recognize` e persiste ClienteRecognized. Pré-condição: existe
// Pessoa. Idempotente por conversa.
// ─────────────────────────────────────────────────────────────────────────────
import { ClienteAggregate, ClienteId, ClientePersonRef, ClienteRecognitionResponsibleRef } from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { skippedOutcome, failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class RecognizeClienteUseCase implements MissionUseCase {
  readonly name = 'RecognizeCliente';
  readonly streamType = 'cliente';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.clienteId !== null) {
      return skippedOutcome(this.name, this.streamType, ctx.identity.clienteId, { clienteId: ctx.identity.clienteId });
    }
    if (ctx.identity.personId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Pessoa não reconhecida (INV-CL-01)');
    }
    const clienteId = this.deps.uuid.next();
    const result = ClienteAggregate.recognize({
      id: ClienteId.fromUuid(clienteId),
      person: ClientePersonRef.fromString(ctx.identity.personId),
      recognizedBy: ClienteRecognitionResponsibleRef.fromString(this.deps.config.ahriResponsibleId),
      recognizedAt: ctx.now,
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      clienteId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.personId),
      { personId: ctx.identity.personId },
    );
    return successOutcome(this.name, this.streamType, clienteId, appended, { clienteId });
  }
}
