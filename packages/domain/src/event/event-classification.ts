// ─────────────────────────────────────────────────────────────────────────────
// EventClassification — Value Object da classificação do Evento.
// Canon: DF-14 — dois subtipos OFICIAIS E EXAUSTIVOS: Relevante e Informativo.
// Conjunto FECHADO (INV-EV-01). A classificação é FORNECIDA no reconhecimento;
// a entidade NÃO decide relevância (isso é o teste determinístico do R4) — apenas
// registra e recusa combinações inválidas.
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

export type EventClassificationValue = 'RELEVANT' | 'INFORMATIVE';

export class EventClassification extends ValueObject<{ value: EventClassificationValue }> {
  private constructor(value: EventClassificationValue) {
    super({ value });
  }

  get value(): EventClassificationValue {
    return this.props.value;
  }

  isRelevant(): boolean {
    return this.props.value === 'RELEVANT';
  }

  isInformative(): boolean {
    return this.props.value === 'INFORMATIVE';
  }

  static relevant(): EventClassification {
    return new EventClassification('RELEVANT');
  }

  static informative(): EventClassification {
    return new EventClassification('INFORMATIVE');
  }

  static create(value: string): Result<EventClassification, CanonViolationError> {
    if (value !== 'RELEVANT' && value !== 'INFORMATIVE') {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-EV-01',
          canonReference: 'Entidade 04 — EVENTO; DF-14 (subtipos exaustivos)',
          message: 'Classificação inválida: todo Evento é Relevante ou Informativo (DF-14).',
        }),
      );
    }
    return Result.ok(new EventClassification(value));
  }
}
