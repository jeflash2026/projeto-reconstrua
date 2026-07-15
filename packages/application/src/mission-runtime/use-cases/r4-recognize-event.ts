// ─────────────────────────────────────────────────────────────────────────────
// R4 — RECONHECER EVENTO. Reconhece um Evento RELEVANTE fundado no Documento como
// Fato (INV-EV-03), em função da Missão (INV-EV-04). Executa `EventAggregate.recognize`
// e persiste EventRecognized. Pré-condições: Missão + Documento (Fato).
// ─────────────────────────────────────────────────────────────────────────────
import { EventAggregate, EventId, EventMissionRef, EventRecognitionResponsibleRef, FactRef } from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import { persistNew, successOutcome, type MissionContext, type MissionUseCase, type UseCaseDeps } from '../use-case.js';

export class RecognizeEventUseCase implements MissionUseCase {
  readonly name = 'RecognizeEvent';
  readonly streamType = 'event';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.missionId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Missão (INV-EV-04)');
    }
    if (ctx.identity.lastDocumentId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Documento como Fato (INV-EV-03)');
    }
    const eventId = this.deps.uuid.next();
    const result = EventAggregate.recognize({
      id: EventId.fromUuid(eventId),
      classification: 'RELEVANT',
      mission: EventMissionRef.fromString(ctx.identity.missionId),
      fact: FactRef.fromString(ctx.identity.lastDocumentId),
      occurredAt: ctx.facts.occurredAt,
      recognizedAt: ctx.now,
      recognizedBy: EventRecognitionResponsibleRef.fromString(this.deps.config.ahriResponsibleId),
    });
    if (result.isErr()) return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      eventId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.lastDocumentId),
      { classification: 'RELEVANT', missionId: ctx.identity.missionId, factRef: ctx.identity.lastDocumentId },
    );
    return successOutcome(this.name, this.streamType, eventId, appended, { lastEventId: eventId });
  }
}
