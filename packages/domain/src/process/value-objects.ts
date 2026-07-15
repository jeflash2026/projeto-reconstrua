// ─────────────────────────────────────────────────────────────────────────────
// Value Objects estritamente necessários ao reconhecimento do Processo.
// Canon: Entidade 06 — PROCESSO. A boa-constituição (item 19) é "pertencente a
// missão, com fundamento jurídico"; o vínculo com a missão é a ProcessMissionRef,
// e aqui fica o fundamento jurídico.
//
// "Fase" (item 14) é DELIBERADAMENTE omitida: seu referente é a Etapa/Estado
// Operacional (Entidades 08/09, posteriores; DF-08), que o item 22 não autoriza
// como referência — modelá-la anteciparia entidade futura. Ver auditoria.
//
// NADA de tecnologia, interpretação ou decisão jurídica (esta é do advogado —
// DF-09). Este VO apenas PRESERVA, de forma imutável, o fundamento fornecido.
// (Nome com prefixo "Process" para não colidir com o VO homônimo de CASO no
// índice do domínio, e para não acoplar as entidades.)
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 06 — PROCESSO';
// Critério de boa-constituição do Canon (item 19: "pertencente a missão, com
// fundamento jurídico"). Não é invariante numerada — é a qualificação definicional;
// por isso um id descritivo, como em CASO-BEM-FORMADO.
const WELL_CONSTITUTED_ID = 'PROCESSO-BEM-CONSTITUIDO';

/**
 * Fundamento jurídico do Processo (Canon: Entidade 06, itens 11/19; DF-01 — o
 * Projeto atua "desde que exista fundamento jurídico para sua atuação").
 * Representação opaca e imutável; o Processo não decide sobre ele (DF-09).
 */
export class ProcessLegalFoundation extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<ProcessLegalFoundation, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: WELL_CONSTITUTED_ID,
          canonReference: `${CANON_REF} (itens 11, 19); DF-01`,
          message: 'Processo sem fundamento jurídico: o Projeto só atua havendo fundamento (DF-01).',
        }),
      );
    }
    return Result.ok(new ProcessLegalFoundation(trimmed));
  }
}
