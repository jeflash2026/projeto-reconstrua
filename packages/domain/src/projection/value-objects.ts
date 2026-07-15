// ─────────────────────────────────────────────────────────────────────────────
// Value Objects estritamente necessários à Projeção.
// Canon: Entidade 10 — PROJEÇÃO. Propriedades (item 14): derivação;
// recalculabilidade; subordinação à Verdade.
//
// DerivedReading é a própria leitura derivada — a métrica/indicador/cenário
// (itens 3/20), SEMPRE declarada como derivada (item 19), JAMAIS apresentada como
// verdade (item 17; E4-L08; DF-03). Referência OPACA e imutável: a entidade NÃO
// calcula a métrica (isso é Regra Operacional/DF-13) nem a interpreta — apenas a
// preserva, subordinada à Verdade.
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 10 — PROJEÇÃO (itens 3, 19); DF-03';
const READING_ID = 'PJ-LEITURA-DERIVADA';

/**
 * Leitura derivada da Verdade (Canon: itens 3/19/20; DF-03). Opaca e imutável;
 * a Projeção a apresenta como derivada, jamais como verdade. Presença exigida —
 * uma Projeção sem leitura não informaria nada.
 */
export class DerivedReading extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<DerivedReading, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: READING_ID,
          canonReference: CANON_REF,
          message: 'Projeção sem leitura derivada: não há métrica/leitura a informar (itens 3/19).',
        }),
      );
    }
    return Result.ok(new DerivedReading(trimmed));
  }
}
