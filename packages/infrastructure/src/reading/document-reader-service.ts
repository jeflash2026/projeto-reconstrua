// ─────────────────────────────────────────────────────────────────────────────
// DocumentReaderService (CAT-03A) — transforma um documento em TEXTO BRUTO:
//   documentId → DocumentLink (sha256) → cache → MediaStore (bytes) → Vision → cache.
// NUNCA lança; sem extração/interpretação/evento/gatilho. Apenas EXISTE e é
// invocável (readById). Ninguém o chama automaticamente nesta sprint.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { DocumentLinkStore, MediaStorePort } from '../media/index.js';
import type { DocumentReaderPort } from './document-reader-port.js';
import type { DocumentTextCache } from './document-text-cache.js';

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB (alinhado ao cap de captura CAT-02A)
const READABLE_MIMES: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];

export interface DocumentReaderDeps {
  readonly links: DocumentLinkStore;
  readonly store: MediaStorePort;
  readonly reader: DocumentReaderPort;
  readonly cache: DocumentTextCache;
  readonly model: string;
  readonly clock: Clock;
  readonly maxBytes?: number;
  readonly log?: (message: string) => void;
}

export class DocumentReaderService {
  private readonly maxBytes: number;

  constructor(private readonly deps: DocumentReaderDeps) {
    this.maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  /** documentId → texto bruto (cacheado por sha256). null se indisponível. NUNCA lança. */
  async readById(documentId: string): Promise<string | null> {
    try {
      const link = await this.deps.links.byDocumentId(documentId);
      if (link === null) {
        this.log(`sem vinculo para ${documentId}`);
        return null;
      }
      const cached = await this.deps.cache.get(link.sha256);
      if (cached !== null) return cached.text; // dedup: já lido

      const blob = await this.deps.store.read(link.sha256);
      if (blob === null) {
        this.log(`sem blob para ${link.sha256}`);
        return null;
      }
      if (!READABLE_MIMES.includes(blob.mime)) {
        this.log(`mime nao legivel: ${blob.mime}`);
        return null;
      }
      if (blob.size > this.maxBytes) {
        this.log(`documento grande demais: ${String(blob.size)} bytes`);
        return null;
      }

      const text = await this.deps.reader.read(blob.bytes, blob.mime);
      if (text === null || text === '') {
        this.log(`visao nao retornou texto para ${link.sha256}`);
        return null;
      }

      await this.deps.cache.put({
        sha256: link.sha256,
        text,
        model: this.deps.model,
        chars: text.length,
        readAt: this.deps.clock.now().toISOString(),
      });
      return text;
    } catch (error) {
      this.log(`falha na leitura: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private log(message: string): void {
    if (this.deps.log) this.deps.log(message);
  }
}
