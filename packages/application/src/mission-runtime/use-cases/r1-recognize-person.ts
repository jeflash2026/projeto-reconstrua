// ─────────────────────────────────────────────────────────────────────────────
// R1 — RECONHECER PESSOA. Executa a fábrica CONGELADA `Person.recognize` e persiste
// PersonRecognized no stream 'person'. Idempotente por conversa (se já há Pessoa,
// pula). Nunca instancia o agregado por fora nem toca infra.
// ─────────────────────────────────────────────────────────────────────────────
import { EvidenceRef, Person, PersonId, RecognitionResponsibleRef } from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { skippedOutcome, failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class RecognizePersonUseCase implements MissionUseCase {
  readonly name = 'RecognizePerson';
  readonly streamType = 'person';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.personId !== null) {
      return skippedOutcome(this.name, this.streamType, ctx.identity.personId, { personId: ctx.identity.personId });
    }
    const personId = this.deps.uuid.next();
    const evidenceId = this.deps.uuid.next();
    const result = Person.recognize({
      id: PersonId.fromUuid(personId),
      civilIdentityText: ctx.facts.senderId,
      originText: `WhatsApp:${ctx.facts.chatId}`,
      recognizedAt: ctx.now,
      responsible: RecognitionResponsibleRef.fromString(this.deps.config.ahriResponsibleId),
      evidences: [EvidenceRef.fromUuid(evidenceId)],
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      personId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.facts.messageId),
      { civilIdentity: ctx.facts.senderId, origin: `WhatsApp:${ctx.facts.chatId}`, senderId: ctx.facts.senderId },
    );
    return successOutcome(this.name, this.streamType, personId, appended, { personId });
  }
}
