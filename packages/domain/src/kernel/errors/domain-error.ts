// ─────────────────────────────────────────────────────────────────────────────
// DomainError — raiz de todos os erros de domínio. Puro (estende Error, primitiva
// da linguagem). Nenhuma dependência de tecnologia.
// ─────────────────────────────────────────────────────────────────────────────

export abstract class DomainError extends Error {
  /** Código estável, legível por máquina (ex.: 'DOMAIN.INVARIANT_VIOLATION'). */
  abstract readonly code: string;

  /** Detalhes estruturados opcionais para auditoria. */
  readonly details?: Readonly<Record<string, unknown>>;

  protected constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = new.target.name;
    if (details !== undefined) {
      this.details = details;
    }
    // Preserva instanceof mesmo após transpilação.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
