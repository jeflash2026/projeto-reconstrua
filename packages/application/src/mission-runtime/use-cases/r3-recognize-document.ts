// ─────────────────────────────────────────────────────────────────────────────
// R3 — RECONHECER DOCUMENTO. Executa `DocumentAggregate.recognize`, incorporando-o
// à Missão (INV-D08). Persiste DocumentRecognized. Pré-condição: existe Missão.
// ─────────────────────────────────────────────────────────────────────────────
import {
  DocumentAggregate,
  DocumentId,
  DocumentRecognitionResponsibleRef,
  MissionRef,
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

export class RecognizeDocumentUseCase implements MissionUseCase {
  readonly name = 'RecognizeDocument';
  readonly streamType = 'document';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.missionId === null) {
      return failedOutcome(
        this.name,
        this.streamType,
        'pré-condição ausente: Missão para incorporar o documento (INV-D08)',
      );
    }
    const documentId = this.deps.uuid.next();
    const contentReference =
      ctx.facts.fileName ?? ctx.facts.mediaRef ?? ctx.facts.text ?? 'documento percebido';
    const result = DocumentAggregate.recognize({
      id: DocumentId.fromUuid(documentId),
      originText: `WhatsApp:${ctx.facts.chatId}`,
      incorporatedInto: [MissionRef.fromString(ctx.identity.missionId)],
      contentReferenceText: contentReference,
      recognizedAt: ctx.now,
      recognizedBy: DocumentRecognitionResponsibleRef.fromString(
        this.deps.config.ahriResponsibleId,
      ),
    });
    if (result.isErr())
      return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      documentId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.facts.messageId),
      { missionId: ctx.identity.missionId, contentReference, mimeType: ctx.facts.mimeType },
    );
    return successOutcome(this.name, this.streamType, documentId, appended, {
      lastDocumentId: documentId,
    });
  }
}
