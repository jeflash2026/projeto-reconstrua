// ─────────────────────────────────────────────────────────────────────────────
// PHRASING — utilidades puras de linguagem para impor "NUNCA repetir frases".
//
// Não gera texto (isso é do LLM de expressão). Apenas MEDE semelhança para o
// guard anti-repetição decidir, de forma determinística, se um fraseado é repetido
// demais e precisa ser refeito. Determinístico e sem tecnologia.
// ─────────────────────────────────────────────────────────────────────────────

// Faixa de diacríticos combinantes (U+0300–U+036F). Construída de escapes ASCII
// para não conter caracteres invisíveis no código-fonte.
const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
const NON_ALPHANUMERIC = /[^a-z0-9\s]/g;
const WHITESPACE = /\s+/g;

/** Normaliza para comparação: minúsculas, sem acentos/pontuação, espaços colapsados. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(NON_ALPHANUMERIC, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}

function tokenSet(text: string): Set<string> {
  const normalized = normalizeText(text);
  if (normalized === '') return new Set<string>();
  return new Set(normalized.split(' '));
}

/**
 * Similaridade de Jaccard entre dois textos (0 = nada em comum, 1 = idênticos em
 * conjunto de tokens). Estável e simétrica.
 */
export function similarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * O `candidate` repete demais algum `previous` (acima de `threshold`)? Texto
 * idêntico normalizado é sempre repetição.
 */
export function isRepetition(
  candidate: string,
  previous: readonly string[],
  threshold: number,
): boolean {
  const normalizedCandidate = normalizeText(candidate);
  for (const prev of previous) {
    if (normalizeText(prev) === normalizedCandidate) return true;
    if (similarity(candidate, prev) >= threshold) return true;
  }
  return false;
}
