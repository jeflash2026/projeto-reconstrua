// ─────────────────────────────────────────────────────────────────────────────
// R4 — RECONHECER EVENTO. Reconhece um Evento RELEVANTE fundado no Documento como
// Fato (INV-EV-03), em função da Missão (INV-EV-04). Executa `EventAggregate.recognize`
// e persiste EventRecognized. Pré-condições: Missão + Documento (Fato).
// ─────────────────────────────────────────────────────────────────────────────
import {
  EventAggregate,
  EventId,
  EventMissionRef,
  EventRecognitionResponsibleRef,
  FactRef,
  type EventClassificationValue,
} from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import {
  persistNew,
  successOutcome,
  type MissionContext,
  type MissionUseCase,
  type UseCaseDeps,
} from '../use-case.js';

export class RecognizeEventUseCase implements MissionUseCase {
  readonly name = 'RecognizeEvent';
  readonly streamType = 'event';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.missionId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Missão (INV-EV-04)');
    }
    if (ctx.identity.lastDocumentId === null) {
      return failedOutcome(
        this.name,
        this.streamType,
        'pré-condição ausente: Documento como Fato (INV-EV-03)',
      );
    }
    const eventId = this.deps.uuid.next();
    // RFC-0044: a relevância vem de UMA instância de PerceivedFact (fonte única);
    // classification, isRelevant e payload.classification derivam TODOS dela. Ausente ⇒ RELEVANT.
    const classification: EventClassificationValue =
      ctx.facts.perceivedRelevance?.value ?? 'RELEVANT';
    const result = EventAggregate.recognize({
      id: EventId.fromUuid(eventId),
      classification,
      mission: EventMissionRef.fromString(ctx.identity.missionId),
      fact: FactRef.fromString(ctx.identity.lastDocumentId),
      occurredAt: ctx.facts.occurredAt,
      recognizedAt: ctx.now,
      recognizedBy: EventRecognitionResponsibleRef.fromString(this.deps.config.ahriResponsibleId),
    });
    if (result.isErr())
      return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      eventId,
      result.unwrap(),
      classification === 'RELEVANT',
      foundedProvenance(ctx.intent, ctx.identity.lastDocumentId),
      { classification, missionId: ctx.identity.missionId, factRef: ctx.identity.lastDocumentId },
    );
    return successOutcome(this.name, this.streamType, eventId, appended, { lastEventId: eventId });
  }
}
