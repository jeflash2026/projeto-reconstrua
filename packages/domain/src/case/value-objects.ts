// ─────────────────────────────────────────────────────────────────────────────
// Value Objects estritamente necessários ao reconhecimento do Caso.
// Canon: Entidade 05 — CASO. As propriedades constitutivas (item 14) são:
// "Contexto jurídico; vínculo com a missão; fundamento jurídico (DF-01)". O
// vínculo é a CaseMissionRef; aqui ficam os dois VOs textuais.
//
// NADA de tecnologia, interpretação ou decisão: o Caso "jamais decide" (item 16;
// DF-09). Estes VOs apenas PRESERVAM, de forma imutável, o enquadramento jurídico
// fornecido — não o computam nem o interpretam.
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 05 — CASO';
// Critério de boa-formação do Canon (item 19: "Bem formado = contexto jurídico
// claro, com fundamento"). Não é uma invariante numerada — é a qualificação
// definicional do Caso; por isso um id descritivo, como em EVENTO-RASTREABILIDADE.
const WELL_FORMED_ID = 'CASO-BEM-FORMADO';

/**
 * Contexto jurídico — o enquadramento jurídico do que a missão persegue
 * (Canon: Entidade 05, itens 3 e 14). Presença exigida pela boa-formação
 * (item 19). Representação opaca e imutável; o Caso não interpreta.
 */
export class LegalContext extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<LegalContext, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: WELL_FORMED_ID,
          canonReference: `${CANON_REF} (itens 3, 14, 19); DF-08`,
          message: 'Caso sem contexto jurídico: não há enquadramento a reconhecer (item 19).',
        }),
      );
    }
    return Result.ok(new LegalContext(trimmed));
  }
}

/**
 * Fundamento jurídico (Canon: Entidade 05, itens 14 e 19; DF-01 — o Projeto atua
 * "desde que exista fundamento jurídico para sua atuação"). Presença exigida pela
 * boa-formação. Representação opaca e imutável; o Caso não decide sobre ele.
 */
export class LegalFoundation extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<LegalFoundation, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: WELL_FORMED_ID,
          canonReference: `${CANON_REF} (itens 14, 19); DF-01`,
          message: 'Caso sem fundamento jurídico: o Projeto só atua havendo fundamento (DF-01).',
        }),
      );
    }
    return Result.ok(new LegalFoundation(trimmed));
  }
}
