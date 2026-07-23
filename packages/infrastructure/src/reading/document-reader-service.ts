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
  /** Leituras EM ANDAMENTO por conteúdo (sha256) — um documento é lido UMA vez,
   *  mesmo sob leituras concorrentes (painel refrescando + tick): a segunda
   *  aguarda a MESMA leitura em vez de disparar a Vision de novo. Custo justo:
   *  1 leitura por conteúdo. (caso custo inflado — o mesmo HISCON lido 27×.) */
  private readonly emVoo = new Map<string, Promise<string | null>>();

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
      if (cached !== null) return cached.text; // dedup: já lido (cache)

      // Já há uma leitura EM VOO para este conteúdo? Aguarda a mesma — nunca lê 2×.
      const emAndamento = this.emVoo.get(link.sha256);
      if (emAndamento !== undefined) return await emAndamento;

      const promessa = this.lerEArmazenar(documentId, link.sha256);
      this.emVoo.set(link.sha256, promessa);
      try {
        return await promessa;
      } finally {
        this.emVoo.delete(link.sha256);
      }
    } catch (error) {
      this.log(`falha na leitura: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /** Lê o blob (local/Vision), registra o custo e cacheia. Chamado no MÁXIMO uma
   *  vez por sha256 por vez (o `emVoo` garante). Nunca lança (o chamador captura). */
  private async lerEArmazenar(documentId: string, sha256: string): Promise<string | null> {
    const blob = await this.deps.store.read(sha256);
    if (blob === null) {
      this.log(`sem blob para ${sha256}`);
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
      this.log(`visao nao retornou texto para ${sha256}`);
      return null;
    }
    // Medidor de Custo: leitura LOCAL (extração mecânica do PDF) custa ZERO —
    // registra com provider 'local'/tokens 0 (o painel mostra $0). Leitura por
    // Vision registra o provedor e os tokens reais.
    if (this.deps.custo) {
      const local = leitura.metodo === 'local';
      await this.deps.custo.registrarLeitura({
        provider: local ? 'local' : 'anthropic',
        model: local ? 'pdf-local' : this.deps.model,
        documentId,
        tokensIn: local ? 0 : leitura.tokensIn,
        tokensOut: local ? 0 : leitura.tokensOut,
      });
    }

    await this.deps.cache.put({
      sha256,
      text: leitura.texto,
      model: this.deps.model,
      chars: leitura.texto.length,
      readAt: this.deps.clock.now().toISOString(),
    });
    return leitura.texto;
  }

  private log(message: string): void {
    if (this.deps.log) this.deps.log(message);
  }
}
