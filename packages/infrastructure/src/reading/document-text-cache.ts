// ─────────────────────────────────────────────────────────────────────────────
// DocumentTextCache — cache do TEXTO BRUTO por sha256 (documento imutável ⇒ texto
// cacheado uma vez por conteúdo). Reutiliza EXCLUSIVAMENTE production.documents
// (JsonStore), namespace próprio. Nenhuma tabela nova.
// ─────────────────────────────────────────────────────────────────────────────
import type { JsonStore } from '../production/json-store.js';

export interface CachedText {
  readonly sha256: string;
  readonly text: string;
  readonly model: string;
  readonly chars: number;
  readonly readAt: string;
}

export interface DocumentTextCache {
  get(sha256: string): Promise<CachedText | null>;
  put(entry: CachedText): Promise<void>;
}

const NAMESPACE = 'document-text';

export class JsonDocumentTextCache implements DocumentTextCache {
  constructor(private readonly store: JsonStore) {}

  async get(sha256: string): Promise<CachedText | null> {
    const raw = await this.store.get(NAMESPACE, sha256);
    return (raw as CachedText | null) ?? null;
  }

  put(entry: CachedText): Promise<void> {
    return this.store.put(NAMESPACE, entry.sha256, entry);
  }
}
