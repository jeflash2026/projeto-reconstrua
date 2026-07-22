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
// ─────────────────────────────────────────────────────────────────────────────

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
    const doc = await unpdf.getDocumentProxy(bytes);
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
