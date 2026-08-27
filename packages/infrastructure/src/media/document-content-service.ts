// ─────────────────────────────────────────────────────────────────────────────
// DocumentContentService (CAT-02C) — resolve o CONTEÚDO real de um documento por
// documentId: DocumentLink (documentId → sha256) → MediaStore.read (bytes+mime).
// Reutiliza CAT-02B (vínculo) e CAT-02A (blob). Sem OCR/IA/leitura — só serve.
// ─────────────────────────────────────────────────────────────────────────────
import type { DocumentLinkStore } from './document-link-store.js';
import type { MediaStorePort } from './media-store-port.js';

export interface DocumentContent {
  readonly bytes: Uint8Array;
  readonly mime: string;
  readonly size: number;
}

export class DocumentContentService {
  constructor(
    private readonly links: DocumentLinkStore,
    private readonly store: MediaStorePort,
  ) {}

  /** Conteúdo do documento, ou null se não houver vínculo/blob. */
  async byDocumentId(documentId: string): Promise<DocumentContent | null> {
    const link = await this.links.byDocumentId(documentId);
    if (link === null) return null;
    const blob = await this.store.read(link.sha256);
    if (blob === null) return null;
    return { bytes: blob.bytes, mime: blob.mime, size: blob.size };
  }

  /** DIAGNÓSTICO (2026-08-27, caso Cynthia "não baixa"): QUAL elo quebrou —
   *  'sem-vinculo' (a captura nunca ligou documento→arquivo) ou 'sem-arquivo'
   *  (vínculo existe, o blob sumiu do acervo). null = está tudo lá. */
  async motivoIndisponivel(documentId: string): Promise<'sem-vinculo' | 'sem-arquivo' | null> {
    const link = await this.links.byDocumentId(documentId).catch(() => null);
    if (link === null) return 'sem-vinculo';
    const blob = await this.store.read(link.sha256).catch(() => null);
    return blob === null ? 'sem-arquivo' : null;
  }
}
