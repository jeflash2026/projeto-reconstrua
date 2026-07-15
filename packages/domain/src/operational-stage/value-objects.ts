// ─────────────────────────────────────────────────────────────────────────────
// Value Objects estritamente necessários à Etapa Operacional.
// Canon: Entidade 09 — ETAPA OPERACIONAL. Propriedades (item 14): correspondência
// 1:1 com o Estado; unicidade; pode ser a etapa especializada PERÍCIA (DF-17 —
// entidade posterior, NÃO modelada aqui: Lei da Definição Local).
//
// StageForm é a FORMA APRESENTÁVEL do estado (itens 2/3: "a forma pela qual o
// Estado se apresenta"; "a face apresentável"; item 19: compreensível — Art. 11º).
// Referência OPACA e imutável: a entidade NÃO interpreta nem computa a forma —
// apenas a preserva fielmente. NÃO é um catálogo fechado de etapas (os estados não
// terminais são dados operacionais, não Canon).
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 09 — ETAPA OPERACIONAL (itens 2, 3, 19); DF-08; Art. 11º';
const FORM_ID = 'ET-FORMA-APRESENTAVEL';

/**
 * Forma apresentável pela qual o Estado se mostra (Canon: itens 2/3/19; DF-08;
 * Art. 11º). Opaca e imutável; a Etapa apresenta fielmente, jamais interpreta ou
 * altera. Presença exigida — uma Etapa sem forma não representaria nada.
 */
export class StageForm extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<StageForm, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: FORM_ID,
          canonReference: CANON_REF,
          message: 'Etapa sem forma apresentável: não há como apresentar o Estado (itens 2/3).',
        }),
      );
    }
    return Result.ok(new StageForm(trimmed));
  }
}
