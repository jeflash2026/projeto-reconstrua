// ─────────────────────────────────────────────────────────────────────────────
// LOCAL-FIRST DOCUMENT READER (decreto Economia da Leitura, 2026-07-22) — a
// cadeia econômica e segura:
//
//   PDF  →  1) EXTRAÇÃO LOCAL (mecânica, custo zero, texto literal)
//           2) PORTÃO: o texto local é substancial? (PDF nativo tem camada de
//              texto; escaneado não) → SIM usa; NÃO cai na Vision
//   Imagem (JPG/PNG) → Vision direto (só a IA "lê" uma foto)
//
// Garantia jurídica: a extração local NÃO PODE inventar um contrato — devolve o
// texto EXATO do arquivo. No pior caso (colunas embaralhadas) ela OMITE, nunca
// INVENTA. A Vision (fallback) só TRANSCREVE. Cada leitura carrega o `metodo`
// (local/vision) para auditoria. NUNCA lança.
// ─────────────────────────────────────────────────────────────────────────────
import type { DocumentReaderPort, LeituraDeDocumento } from './document-reader-port.js';
import type { PdfTextExtractorPort } from './pdf-text-extractor.js';

/** Piso de caracteres para CONFIAR na extração local (abaixo disso ⇒ o PDF é
 *  provavelmente escaneado/foto disfarçada de PDF ⇒ Vision). */
const MIN_CHARS_LOCAIS = 40;

export interface LocalFirstReaderDeps {
  readonly extractor: PdfTextExtractorPort;
  /** O leitor por IA — usado para imagens SEMPRE e para PDF só como fallback. */
  readonly vision: DocumentReaderPort;
  readonly minCharsLocais?: number;
  readonly log?: (message: string) => void;
}

export class LocalFirstDocumentReader implements DocumentReaderPort {
  private readonly minChars: number;

  constructor(private readonly deps: LocalFirstReaderDeps) {
    this.minChars = deps.minCharsLocais ?? MIN_CHARS_LOCAIS;
  }

  async read(bytes: Uint8Array, mime: string): Promise<LeituraDeDocumento | null> {
    if (mime === 'application/pdf') {
      const local = await this.deps.extractor.extract(bytes).catch(() => null);
      if (local !== null && local.length >= this.minChars) {
        this.deps.log?.(`leitura LOCAL do PDF (${String(local.length)} chars) — custo zero`);
        return { texto: local, tokensIn: null, tokensOut: null, metodo: 'local' };
      }
      this.deps.log?.(
        `PDF sem camada de texto útil (${String(local?.length ?? 0)} chars) — caindo na Vision`,
      );
    }
    // Imagem, ou PDF que não passou no portão local ⇒ IA.
    const visto = await this.deps.vision.read(bytes, mime);
    return visto === null ? null : { ...visto, metodo: 'vision' };
  }
}
