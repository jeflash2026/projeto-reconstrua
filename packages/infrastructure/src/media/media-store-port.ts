// ─────────────────────────────────────────────────────────────────────────────
// MediaStorePort — persistência content-addressed dos BYTES reais de uma mídia.
// A chave é o sha256 do conteúdo (deduplicação natural + prova de integridade).
// CAT-02A: é a ÚNICA persistência (o vínculo por-mensagem é do CAT-02B).
// ─────────────────────────────────────────────────────────────────────────────
export interface StoredBlob {
  readonly sha256: string;
  readonly mime: string;
  readonly size: number;
  readonly bytes: Uint8Array;
}

export interface MediaStorePort {
  /** Já existe um blob com este sha256? (deduplicação) */
  has(sha256: string): Promise<boolean>;
  /** Persiste o blob (idempotente por sha256). */
  put(blob: StoredBlob): Promise<void>;
  /** CAT-02C: lê o blob pelo sha256 (para servir aos humanos, uso interno). null se ausente. */
  read(sha256: string): Promise<StoredBlob | null>;
}
