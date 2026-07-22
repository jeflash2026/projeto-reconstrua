// ─────────────────────────────────────────────────────────────────────────────
// Value Objects estritamente necessários à Verdade Operacional.
// Canon: Entidade 07 — VERDADE OPERACIONAL. Propriedades (item 14): unicidade por
// missão; datação; cadeia demonstrável; incerteza declarada quando existir.
//
// A Verdade "possui NADA; é síntese" (item 12): NÃO carrega o conteúdo do estado
// (isso é ESTADO/ETAPA, 08/09, posteriores). Estes VOs são referências OPACAS e
// IMUTÁVEIS — a entidade NÃO calcula cadeia, NÃO avalia legitimidade (R5), NÃO
// interpreta; apenas PRESERVA o que a síntese (já realizada) produziu.
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 07 — VERDADE OPERACIONAL';
// Guardas derivadas de E8 / item 14 / item 19 — qualificações definicionais, não
// invariantes numeradas (padrão dos ids descritivos, como em CASO-BEM-FORMADO).
const CHAIN_ID = 'VO-CADEIA-DEMONSTRAVEL';
const UNCERTAINTY_ID = 'VO-INCERTEZA-DECLARADA';

/**
 * Justificativa de cadeia demonstrável (Canon: INV-E8-02; E8-L06; itens 14/19 —
 * "cadeia demonstrável", "justificativa completa"). Referência OPACA e imutável à
 * Cadeia Oficial do Conhecimento que sustenta a síntese. A entidade NÃO reconstrói
 * nem verifica a cadeia (isso é E3/R5) — apenas exige e preserva a referência que
 * a torna demonstrável.
 */
export class ChainJustification extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<ChainJustification, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: CHAIN_ID,
          canonReference: `${CANON_REF}; INV-E8-02; E8-L06`,
          message:
            'Verdade Operacional sem cadeia demonstrável: toda Verdade é rastreável até a Cadeia (INV-E8-02).',
        }),
      );
    }
    return Result.ok(new ChainJustification(trimmed));
  }
}

/**
 * Incerteza declarada (Canon: INV-E8-07; E8-L05; item 14 — "incerteza declarada
 * quando existir"). A incerteza é parte legítima e visível da Verdade; JAMAIS
 * ocultada, JAMAIS preenchida artificialmente. Modelada como OPCIONAL na entidade:
 * ausente quando não há incerteza; quando declarada, deve ser substantiva
 * (não-vazia) — declarar incerteza "vazia" seria preenchimento artificial (proibido).
 */
export class DeclaredUncertainty extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<DeclaredUncertainty, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: UNCERTAINTY_ID,
          canonReference: `${CANON_REF}; INV-E8-07`,
          message:
            'Incerteza declarada vazia: a incerteza jamais é preenchida artificialmente (INV-E8-07).',
        }),
      );
    }
    return Result.ok(new DeclaredUncertainty(trimmed));
  }
}
