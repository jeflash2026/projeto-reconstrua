// ─────────────────────────────────────────────────────────────────────────────
// Normalização leve para casamento de termos na memória (sem acentos/pontuação,
// minúsculas). Pura e determinística.
// ─────────────────────────────────────────────────────────────────────────────
const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
const NON_ALPHANUMERIC = /[^a-z0-9\s]/g;
const WHITESPACE = /\s+/g;

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(NON_ALPHANUMERIC, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}
