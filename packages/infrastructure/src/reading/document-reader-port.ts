// ─────────────────────────────────────────────────────────────────────────────
// DocumentReaderPort — transforma o CONTEÚDO de um documento (imagem/PDF) em
// TEXTO BRUTO. Sem extração de campos, sem interpretação, sem classificação.
// Devolve também o USO (tokens) da chamada — insumo do Medidor de Custo; quem
// não mede (fakes/testes) devolve null nos tokens.
// ─────────────────────────────────────────────────────────────────────────────
export interface LeituraDeDocumento {
  readonly texto: string;
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
}

export interface DocumentReaderPort {
  /** Transcreve o conteúdo em texto bruto. null se o mime não é legível ou em erro. */
  read(bytes: Uint8Array, mime: string): Promise<LeituraDeDocumento | null>;
}
