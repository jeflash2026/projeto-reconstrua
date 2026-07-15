// ─────────────────────────────────────────────────────────────────────────────
// Value Objects estritamente necessários aos elementos de nascimento da Missão.
// Canon: DF-19 (sete elementos obrigatórios) — "Nenhuma missão poderá nascer
// incompleta" → INV-18. Um objetivo ou motivo vazio equivale a elemento ausente.
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 01 — MISSÃO; DF-19 (sete elementos obrigatórios); INV-18';

/** Objetivo inicial (Canon: elemento de nascimento 3, DF-19). */
export class InitialObjective extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<InitialObjective, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-18',
          canonReference: CANON_REF,
          message: 'Objetivo inicial ausente: a missão não pode nascer incompleta (DF-19).',
        }),
      );
    }
    return Result.ok(new InitialObjective(trimmed));
  }
}

/** Motivo de abertura (Canon: elemento de nascimento 4, DF-19). */
export class OpeningReason extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<OpeningReason, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-18',
          canonReference: CANON_REF,
          message: 'Motivo de abertura ausente: a missão não pode nascer incompleta (DF-19).',
        }),
      );
    }
    return Result.ok(new OpeningReason(trimmed));
  }
}
