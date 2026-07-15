// ─────────────────────────────────────────────────────────────────────────────
// Value Objects da Regra Operacional. Materializam os DEZ ELEMENTOS obrigatórios
// da DF-13 (INV-RO-01) + o fundamento superior citado (item 11/19; INV-RO-02).
//
// TODOS são referências OPACAS e imutáveis: a entidade PRESERVA os elementos como
// DADOS — jamais executa a regra, jamais avalia os critérios, jamais roda R1–R9.
// "Critério de execução" e "critério de bloqueio" são TEXTO descritivo, não código
// executável; "evento de entrada/saída" são DESCRITORES DE TIPO, não instâncias.
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 12 — REGRA OPERACIONAL; DF-13';
const TEN_ELEMENTS_ID = 'INV-RO-01';
const FOUNDATION_ID = 'RO-FUNDAMENTO-CITADO';

function requireNonEmpty(raw: string): string | null {
  const trimmed = raw?.trim?.() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

/** Identificador único da regra — RO-Rn-NNN (Canon: DF-13, elemento 1). Opaco; sem formato imposto além de presença. */
export class RuleCode extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<RuleCode, CanonViolationError> {
    const v = requireNonEmpty(raw);
    if (v == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: TEN_ELEMENTS_ID,
          canonReference: `${CANON_REF} (elemento 1: identificador único)`,
          message: 'Regra Operacional sem identificador único (DF-13, elemento 1).',
        }),
      );
    }
    return Result.ok(new RuleCode(v));
  }
}

/** Versão da regra — histórico de versões (Canon: DF-13, elemento 10). Presença exigida. */
export class RuleVersion extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<RuleVersion, CanonViolationError> {
    const v = requireNonEmpty(raw);
    if (v == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: TEN_ELEMENTS_ID,
          canonReference: `${CANON_REF} (elemento 10: histórico de versões)`,
          message: 'Regra Operacional sem versão (DF-13, elemento 10).',
        }),
      );
    }
    return Result.ok(new RuleVersion(v));
  }
}

/** Fundamento superior citado no Canon (Canon: item 11/19; INV-RO-02; Lei Geral das RO). Presença exigida. */
export class CanonFoundation extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<CanonFoundation, CanonViolationError> {
    const v = requireNonEmpty(raw);
    if (v == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: FOUNDATION_ID,
          canonReference: 'Entidade 12, itens 11/19; INV-RO-02; Lei Geral das RO',
          message: 'Regra Operacional sem fundamento superior citado (item 19; INV-RO-02).',
        }),
      );
    }
    return Result.ok(new CanonFoundation(v));
  }
}

/** Campos descritivos da definição da Regra (DF-13, elementos 2–8). */
export type RuleDefinitionFields = {
  readonly name: string; // elemento 2
  readonly objective: string; // elemento 3
  readonly executionCriterion: string; // elemento 4 (texto descritivo, NÃO executável)
  readonly blockingCriterion: string; // elemento 5 (texto descritivo)
  readonly inputEvent: string; // elemento 6 (descritor de tipo de evento)
  readonly outputEvent: string; // elemento 7 (descritor de tipo de evento)
  readonly producedEvidence: string; // elemento 8
};

const DEFINITION_ELEMENTS: ReadonlyArray<[keyof RuleDefinitionFields, string]> = [
  ['name', 'nome (elemento 2)'],
  ['objective', 'objetivo (elemento 3)'],
  ['executionCriterion', 'critério de execução (elemento 4)'],
  ['blockingCriterion', 'critério de bloqueio (elemento 5)'],
  ['inputEvent', 'evento de entrada (elemento 6)'],
  ['outputEvent', 'evento de saída (elemento 7)'],
  ['producedEvidence', 'evidências produzidas (elemento 8)'],
];

/**
 * Definição da Regra — os elementos 2 a 8 da DF-13, todos obrigatórios (INV-RO-01).
 * Opaca e imutável; a entidade preserva os descritores, jamais os executa.
 */
export class RuleDefinition extends ValueObject<RuleDefinitionFields> {
  private constructor(fields: RuleDefinitionFields) {
    super(fields);
  }
  get name(): string {
    return this.props.name;
  }
  get objective(): string {
    return this.props.objective;
  }
  get executionCriterion(): string {
    return this.props.executionCriterion;
  }
  get blockingCriterion(): string {
    return this.props.blockingCriterion;
  }
  get inputEvent(): string {
    return this.props.inputEvent;
  }
  get outputEvent(): string {
    return this.props.outputEvent;
  }
  get producedEvidence(): string {
    return this.props.producedEvidence;
  }
  static create(fields: RuleDefinitionFields): Result<RuleDefinition, CanonViolationError> {
    const normalized: Record<string, string> = {};
    for (const [key, label] of DEFINITION_ELEMENTS) {
      const v = requireNonEmpty(fields[key]);
      if (v == null) {
        return Result.err(
          new CanonViolationError({
            invariantId: TEN_ELEMENTS_ID,
            canonReference: `${CANON_REF} (${label})`,
            message: `Regra Operacional sem ${label} (DF-13).`,
          }),
        );
      }
      normalized[key] = v;
    }
    return Result.ok(new RuleDefinition(normalized as unknown as RuleDefinitionFields));
  }
}
