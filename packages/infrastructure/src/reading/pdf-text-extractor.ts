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
// HISCON (Frente 2): quando o PDF é o HISCON matriz do Meu INSS, a extração
// LINEAR embaralha a tabela. Antes de devolver, tentamos a RECONSTRUÇÃO POSICIONAL
// (por coordenadas) — que devolve o texto Formato A com cada valor no campo certo.
// Só quando ela reconhece a tabela de contratos; senão segue o texto linear.
// ─────────────────────────────────────────────────────────────────────────────
import { reconstruirHisconPosicional, type ItemPosicional } from './hiscon-posicional.js';

interface PdfJsProxy {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: ItemPosicional[] }> }>;
}

/** Texto embutido do PDF (null quando não há camada de texto ou em erro). */
export async function extrairTextoDePdf(bytes: Uint8Array): Promise<string | null> {
  try {
    // Import DINÂMICO: unpdf é ESM e o build pesado do pdf.js só carrega quando
    // realmente há um PDF para ler (nada no caminho quente da conversa). O
    // módulo é tipado explicitamente (os .d.ts do unpdf não resolvem no import
    // dinâmico) — sem `any` solto atravessando a leitura de documento jurídico.
    const unpdf = (await import('unpdf')) as {
      getDocumentProxy: (bytes: Uint8Array) => Promise<unknown>;
      extractText: (
        doc: unknown,
        opts: { mergePages: boolean },
      ) => Promise<{ text: string | string[] }>;
    };
    // CAUSA RAIZ (caso Maria, 2026-07-22): o pdf.js ASSUME A POSSE do buffer e o
    // DETACHA (esvazia) ao ler. O LocalFirstReader chama a extração local ANTES da
    // Vision usando o MESMO Uint8Array — sem a cópia, a Vision recebia o PDF já
    // esvaziado ("PDF cannot be empty", HTTP 400) e a leitura de TODO HISCON
    // falhava. Passamos uma CÓPIA ao pdf.js: os bytes do chamador ficam íntegros.
    const copia = bytes.slice();
    const doc = (await unpdf.getDocumentProxy(copia)) as PdfJsProxy;

    // Frente 2: reconstrução POSICIONAL do HISCON matriz (valor no campo certo).
    const paginas: ItemPosicional[][] = [];
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      paginas.push((await page.getTextContent()).items);
    }
    const hiscon = reconstruirHisconPosicional(paginas);
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
