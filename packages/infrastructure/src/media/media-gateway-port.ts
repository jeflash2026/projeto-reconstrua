// ─────────────────────────────────────────────────────────────────────────────
// MediaGatewayPort — obtém o CONTEÚDO real (base64) de uma mídia recebida, a
// partir do payload cru do webhook. Retorna null quando indisponível.
// ─────────────────────────────────────────────────────────────────────────────
export interface FetchedMedia {
  readonly base64: string;
  readonly mime: string;
  readonly fileName: string | null;
}

export interface MediaGatewayPort {
  /** Baixa o conteúdo da mídia da mensagem (payload cru do webhook). null se indisponível. */
  fetch(rawMessage: unknown): Promise<FetchedMedia | null>;
}
