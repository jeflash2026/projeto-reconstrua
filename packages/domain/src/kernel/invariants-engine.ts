// ─────────────────────────────────────────────────────────────────────────────
// InvariantsEngine — avalia um conjunto de invariantes contra um alvo e produz
// um Result. Se qualquer invariante for violada, emite CanonViolationError(s)
// carregando a referência normativa do Livro Mestre. Puro.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from './invariant.js';
import { Result } from './result.js';
import { CanonViolationError } from './errors/canon-violation-error.js';

export class InvariantsEngine {
  /** Retorna todas as violações (vazio = tudo satisfeito). Não lança. */
  static collect<T>(target: T, invariants: ReadonlyArray<Invariant<T>>): CanonViolationError[] {
    const violations: CanonViolationError[] = [];
    for (const invariant of invariants) {
      if (!invariant.isSatisfiedBy(target)) {
        violations.push(
          new CanonViolationError({
            invariantId: invariant.id,
            canonReference: invariant.canonReference,
            message: `Invariante violada [${invariant.id}]: ${invariant.description}`,
          }),
        );
      }
    }
    return violations;
  }

  /**
   * Garante que o alvo satisfaz TODAS as invariantes.
   * Ok(target) se conforme; Err(primeira violação) caso contrário.
   */
  static enforce<T>(
    target: T,
    invariants: ReadonlyArray<Invariant<T>>,
  ): Result<T, CanonViolationError> {
    const violations = InvariantsEngine.collect(target, invariants);
    const first = violations[0];
    return first === undefined ? Result.ok(target) : Result.err(first);
  }

  /** Versão que agrega todas as violações num único resultado. */
  static enforceAll<T>(
    target: T,
    invariants: ReadonlyArray<Invariant<T>>,
  ): Result<T, CanonViolationError[]> {
    const violations = InvariantsEngine.collect(target, invariants);
    return violations.length === 0 ? Result.ok(target) : Result.err(violations);
  }
}
