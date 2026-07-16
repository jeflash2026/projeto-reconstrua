// ─────────────────────────────────────────────────────────────────────────────
// MediaReferenceStore — vínculo messageId → sha256 (qual blob veio de qual
// mensagem). Reutiliza EXCLUSIVAMENTE production.documents (JsonStore), namespace
// próprio. É a metade que faltava para o vínculo definitivo (CAT-02B).
// ─────────────────────────────────────────────────────────────────────────────
import type { JsonStore } from '../production/json-store.js';

export interface MediaReference {
  readonly messageId: string;
  readonly sha256: string;
  readonly mime: string;
  readonly size: number;
}

export interface MediaReferenceStore {
  save(reference: MediaReference): Promise<void>;
  byMessageId(messageId: string): Promise<MediaReference | null>;
}

const NAMESPACE = 'media-message-ref';

export class JsonMediaReferenceStore implements MediaReferenceStore {
  constructor(private readonly store: JsonStore) {}

  save(reference: MediaReference): Promise<void> {
    return this.store.put(NAMESPACE, reference.messageId, reference);
  }

  async byMessageId(messageId: string): Promise<MediaReference | null> {
    const raw = await this.store.get(NAMESPACE, messageId);
    return (raw as MediaReference | null) ?? null;
  }
}
