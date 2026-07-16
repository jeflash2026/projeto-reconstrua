// ─────────────────────────────────────────────────────────────────────────────
// DocumentReaderPort — transforma o CONTEÚDO de um documento (imagem/PDF) em
// TEXTO BRUTO. Sem extração de campos, sem interpretação, sem classificação.
// ─────────────────────────────────────────────────────────────────────────────
export interface DocumentReaderPort {
  /** Transcreve o conteúdo em texto bruto. null se o mime não é legível ou em erro. */
  read(bytes: Uint8Array, mime: string): Promise<string | null>;
}
