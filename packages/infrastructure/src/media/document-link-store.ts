// ─────────────────────────────────────────────────────────────────────────────
// DocumentLinkStore — o VÍNCULO DEFINITIVO: documentId → { messageId, sha256, mime }.
// Reutiliza EXCLUSIVAMENTE production.documents (JsonStore), namespace próprio.
// ─────────────────────────────────────────────────────────────────────────────
import type { JsonStore } from '../production/json-store.js';

export interface DocumentLink {
  readonly documentId: string;
  readonly messageId: string;
  readonly sha256: string;
  readonly mime: string;
}

export interface DocumentLinkStore {
  save(link: DocumentLink): Promise<void>;
  byDocumentId(documentId: string): Promise<DocumentLink | null>;
}

const NAMESPACE = 'document-link';

export class JsonDocumentLinkStore implements DocumentLinkStore {
  constructor(private readonly store: JsonStore) {}

  save(link: DocumentLink): Promise<void> {
    return this.store.put(NAMESPACE, link.documentId, link);
  }

  async byDocumentId(documentId: string): Promise<DocumentLink | null> {
    const raw = await this.store.get(NAMESPACE, documentId);
    return (raw as DocumentLink | null) ?? null;
  }
}
