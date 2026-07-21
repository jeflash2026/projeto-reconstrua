// ─────────────────────────────────────────────────────────────────────────────
// DocumentReaderService (CAT-03A) — transforma um documento em TEXTO BRUTO:
//   documentId → DocumentLink (sha256) → cache → MediaStore (bytes) → Vision → cache.
// NUNCA lança; sem extração/interpretação/evento/gatilho. Apenas EXISTE e é
// invocável (readById). Ninguém o chama automaticamente nesta sprint.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { MedidorDeCusto } from '../custos/medidor-de-custo.js';
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
  /** Medidor de Custo (2026-07-21): cada leitura por visão vira um registro
   *  de gasto atribuído ao documentId. Ausente ⇒ lê sem medir. */
  readonly custo?: MedidorDeCusto;
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

      const leitura = await this.deps.reader.read(blob.bytes, blob.mime);
      if (leitura === null || leitura.texto === '') {
        this.log(`visao nao retornou texto para ${link.sha256}`);
        return null;
      }
      if (this.deps.custo) {
        await this.deps.custo.registrarLeitura({
          provider: 'anthropic',
          model: this.deps.model,
          documentId,
          tokensIn: leitura.tokensIn,
          tokensOut: leitura.tokensOut,
        });
      }

      await this.deps.cache.put({
        sha256: link.sha256,
        text: leitura.texto,
        model: this.deps.model,
        chars: leitura.texto.length,
        readAt: this.deps.clock.now().toISOString(),
      });
      return leitura.texto;
    } catch (error) {
      this.log(`falha na leitura: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private log(message: string): void {
    if (this.deps.log) this.deps.log(message);
  }
}
