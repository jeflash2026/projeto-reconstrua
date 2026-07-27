// ─────────────────────────────────────────────────────────────────────────────
// PDF TEXT EXTRACTOR (decreto Economia da Leitura, 2026-07-22) — extrai o TEXTO
// EMBUTIDO de um PDF NATIVO localmente, sem IA e sem rede. O HISCON do Meu INSS
// é um PDF digital (camada de texto) — a extração é MECÂNICA: os bytes viram o
// texto LITERAL do documento. Custo zero, os bytes nunca saem da VPS, e é
// IMPOSSÍVEL inventar um contrato (não há modelo interpretando nada).
//
// unpdf usa o build "serverless" do pdf.js (JS puro; o `canvas` — render de
// imagem — não é carregado nesta rota, por isso é neverBuilt no monorepo).
// NUNCA lança: qualquer falha (PDF corrompido, escaneado sem texto) devolve
// null, e o chamador cai na Vision.
//
// HISCON: quando o PDF é o HISCON do Meu INSS, a extração LINEAR embaralha a
// tabela. Tentamos DOIS reconstrutores posicionais e escolhemos o AUDITADO:
//  • V2 (decreto 2026-07-27): coordenadas normalizadas pelo viewport (rotação
//    da página paisagem desfeita) + centros de coluna FIXOS do template do
//    INSS + âncora MM/AAAA por registro + AUDITORIA contra o "Quantitativo de
//    Empréstimos por Situação" declarado na página 1 do próprio documento.
//  • V1 (Frente 2, 2026-07-22): heurística em coordenadas cruas — o fallback.
// escolherLeituraHiscon decide: V2 com auditoria conferida vence; sem
// conferência, vence quem mais se aproxima do declarado. Nenhum leu ⇒ linear.
// ─────────────────────────────────────────────────────────────────────────────
import { reconstruirHisconPosicional, type ItemPosicional } from './hiscon-posicional.js';
import {
  escolherLeituraHiscon,
  reconstruirHisconPosicionalV2,
  type ItemPdf,
  type PaginaPdf,
  type ResultadoPosicionalV2,
} from './hiscon-posicional-v2.js';

interface PdfJsProxy {
  numPages: number;
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: (ItemPosicional & ItemPdf)[] }>;
    getViewport(opts: { scale: number }): { transform: number[] };
  }>;
}

interface UnpdfModulo {
  getDocumentProxy: (bytes: Uint8Array) => Promise<unknown>;
  extractText: (
    doc: unknown,
    opts: { mergePages: boolean },
  ) => Promise<{ text: string | string[] }>;
}

interface PaginasCarregadas {
  readonly doc: PdfJsProxy;
  readonly unpdf: UnpdfModulo;
  readonly paginasCruas: ItemPosicional[][];
  readonly paginasV2: PaginaPdf[];
}

/** Carrega o PDF e os itens posicionais de todas as páginas (cru + viewport). */
async function carregarPaginas(bytes: Uint8Array): Promise<PaginasCarregadas> {
  // Import DINÂMICO: unpdf é ESM e o build pesado do pdf.js só carrega quando
  // realmente há um PDF para ler (nada no caminho quente da conversa). O
  // módulo é tipado explicitamente (os .d.ts do unpdf não resolvem no import
  // dinâmico) — sem `any` solto atravessando a leitura de documento jurídico.
  const unpdf = (await import('unpdf')) as UnpdfModulo;
  // CAUSA RAIZ (caso Maria, 2026-07-22): o pdf.js ASSUME A POSSE do buffer e o
  // DETACHA (esvazia) ao ler. O LocalFirstReader chama a extração local ANTES da
  // Vision usando o MESMO Uint8Array — sem a cópia, a Vision recebia o PDF já
  // esvaziado ("PDF cannot be empty", HTTP 400) e a leitura de TODO HISCON
  // falhava. Passamos uma CÓPIA ao pdf.js: os bytes do chamador ficam íntegros.
  const copia = bytes.slice();
  const doc = (await unpdf.getDocumentProxy(copia)) as PdfJsProxy;
  const paginasCruas: ItemPosicional[][] = [];
  const paginasV2: PaginaPdf[] = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const itens = (await page.getTextContent()).items;
    paginasCruas.push(itens);
    paginasV2.push({ itens, viewportTransform: page.getViewport({ scale: 1 }).transform });
  }
  return { doc, unpdf, paginasCruas, paginasV2 };
}

/** As DUAS leituras posicionais de um HISCON, lado a lado — para o relatório
 *  comparativo (releitura-comparativa). SÓ LEITURA: nada é cacheado/gravado.
 *  null quando o PDF não abre (corrompido/escaneado). */
export interface LeituraComparada {
  readonly v2: ResultadoPosicionalV2 | null;
  readonly v1Texto: string | null;
}

export async function lerHisconParaComparacao(bytes: Uint8Array): Promise<LeituraComparada | null> {
  try {
    const { paginasCruas, paginasV2 } = await carregarPaginas(bytes);
    return {
      v2: reconstruirHisconPosicionalV2(paginasV2),
      v1Texto: reconstruirHisconPosicional(paginasCruas),
    };
  } catch {
    return null;
  }
}

/** Texto embutido do PDF (null quando não há camada de texto ou em erro). */
export async function extrairTextoDePdf(bytes: Uint8Array): Promise<string | null> {
  try {
    const { doc, unpdf, paginasCruas, paginasV2 } = await carregarPaginas(bytes);

    // Reconstrução posicional do HISCON: V2 (template auditado) × V1 (heurística).
    const v2 = reconstruirHisconPosicionalV2(paginasV2);
    const v1 =
      v2 === null || v2.auditoria !== 'conferida'
        ? reconstruirHisconPosicional(paginasCruas)
        : null; // V2 conferido pelo próprio documento ⇒ V1 nem precisa rodar
    const hiscon = escolherLeituraHiscon(v2, v1);
    if (hiscon !== null) return hiscon;

    // Não é HISCON matriz ⇒ texto linear comum.
    const { text } = await unpdf.extractText(doc, { mergePages: true });
    const conteudo = Array.isArray(text) ? text.join('\n') : text;
    const limpo = conteudo.trim();
    return limpo === '' ? null : limpo;
  } catch {
    return null; // PDF escaneado/corrompido ⇒ o chamador usa a Vision
  }
}

export interface PdfTextExtractorPort {
  extract(bytes: Uint8Array): Promise<string | null>;
}

export class PdfTextExtractor implements PdfTextExtractorPort {
  extract(bytes: Uint8Array): Promise<string | null> {
    return extrairTextoDePdf(bytes);
  }
}
