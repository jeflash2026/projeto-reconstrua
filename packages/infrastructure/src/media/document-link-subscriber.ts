// ─────────────────────────────────────────────────────────────────────────────
// DocumentLinkSubscriber — ao reconhecer um Documento (evento 'document.recognized'),
// materializa o vínculo definitivo blob↔mensagem↔documento:
//   documentId (stream) + messageId (provenance.factRef) + sha256 (referência da
//   captura). Se o blob ainda não foi capturado (corrida captura×reconhecimento),
//   LANÇA para o dispatcher re-tentar (retry/DLQ já existentes). NÃO altera o
//   reconhecimento nem qualquer runtime — apenas OBSERVA o evento.
// ─────────────────────────────────────────────────────────────────────────────
import type { EventSubscriber, StoredEvent } from '@reconstrua/application';
import { asString } from './raw.js';
import type { MediaReferenceStore } from './media-reference-store.js';
import type { DocumentLinkStore } from './document-link-store.js';

const DOCUMENT_RECOGNIZED = 'document.recognized';

export class DocumentLinkSubscriber implements EventSubscriber {
  readonly name = 'document-link';
  readonly interestedIn: readonly string[] = [DOCUMENT_RECOGNIZED];

  constructor(
    private readonly references: MediaReferenceStore,
    private readonly links: DocumentLinkStore,
  ) {}

  async handle(event: StoredEvent): Promise<void> {
    if (event.eventType !== DOCUMENT_RECOGNIZED) return;
    const messageId = event.provenance.factRef;
    if (messageId === null || messageId === '') return; // sem messageId não há o que ligar

    const reference = await this.references.byMessageId(messageId);
    if (reference === null) {
      // Blob ainda não capturado (a captura é assíncrona). Re-tentar depois.
      throw new Error(`vinculo adiado: blob da mensagem ${messageId} ainda nao capturado`);
    }

    const documentId = String(event.streamId);
    const mime = asString(event.payload['mimeType']) ?? reference.mime;
    await this.links.save({ documentId, messageId, sha256: reference.sha256, mime });
  }
}
