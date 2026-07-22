// ─────────────────────────────────────────────────────────────────────────────
// Value Objects da AHRI. Materializa o REGISTRO obrigatório da DF-09 para toda
// decisão operacional automatizada (item 14; INV-AH-02):
//   DECISOR: AHRI
//   TIPO:    Decisão Operacional Automatizada
//   FUNDAMENTO: Regra Constitucional + Regra Operacional correspondente
//
// DECISOR e TIPO são FIXOS para a AHRI (DF-09); apenas o FUNDAMENTO varia (cita a
// Regra Constitucional superior + a Regra Operacional). Referência OPACA e imutável:
// a entidade PRESERVA o registro, jamais executa a decisão nem raciocina (E9/E10
// são de outra camada).
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

/** DECISOR fixo do registro DF-09 para a AHRI. */
export const AHRI_DECISOR = 'AHRI' as const;
/** TIPO fixo do registro DF-09 para atuação automatizada da AHRI. */
export const AHRI_DECISION_TYPE = 'DECISAO_OPERACIONAL_AUTOMATIZADA' as const;

/**
 * Registro DECISOR/TIPO/FUNDAMENTO da DF-09 (item 14; INV-AH-02). DECISOR e TIPO
 * são constantes (AHRI / Decisão Operacional Automatizada); FUNDAMENTO é exigido
 * (não-vazio) e deve citar a Regra Constitucional + a Regra Operacional.
 */
export class AutomatedDecisionRecord extends ValueObject<{ fundamento: string }> {
  private constructor(fundamento: string) {
    super({ fundamento });
  }
  get decisor(): typeof AHRI_DECISOR {
    return AHRI_DECISOR;
  }
  get tipo(): typeof AHRI_DECISION_TYPE {
    return AHRI_DECISION_TYPE;
  }
  get fundamento(): string {
    return this.props.fundamento;
  }
  static create(fundamento: string): Result<AutomatedDecisionRecord, CanonViolationError> {
    const trimmed = fundamento?.trim?.() ?? '';
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-AH-02',
          canonReference: 'Entidade 14; INV-AH-02; DF-09 (registro DECISOR/TIPO/FUNDAMENTO)',
          message:
            'Atuação da AHRI sem FUNDAMENTO citado (Regra Constitucional + Regra Operacional) — DF-09.',
        }),
      );
    }
    return Result.ok(new AutomatedDecisionRecord(trimmed));
  }
}
