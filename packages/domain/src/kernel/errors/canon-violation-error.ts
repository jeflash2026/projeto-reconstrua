// ─────────────────────────────────────────────────────────────────────────────
// CanonViolationError — erro emitido quando uma invariante do Livro Mestre é
// violada. É a ponte entre o código e o Canon: sempre carrega a referência
// normativa (ex.: 'INV-02', 'DF-08', 'Lei 2') que foi contrariada.
// Puro. Nenhuma dependência de tecnologia.
// ─────────────────────────────────────────────────────────────────────────────
import { DomainError } from './domain-error.js';

export interface CanonViolationDetails {
  /** Identificador da invariante violada (ex.: 'INV-D09'). */
  readonly invariantId: string;
  /** Referência normativa no Livro Mestre (ex.: 'Entidade 03 — DOCUMENTO; DF-05'). */
  readonly canonReference: string;
}

export class CanonViolationError extends DomainError {
  readonly code = 'DOMAIN.CANON_VIOLATION';
  readonly invariantId: string;
  readonly canonReference: string;

  constructor(params: {
    invariantId: string;
    canonReference: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
  }) {
    super(params.message, {
      invariantId: params.invariantId,
      canonReference: params.canonReference,
      ...(params.details ?? {}),
    });
    this.invariantId = params.invariantId;
    this.canonReference = params.canonReference;
  }
}
