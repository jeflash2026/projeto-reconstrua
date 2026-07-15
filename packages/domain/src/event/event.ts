// ─────────────────────────────────────────────────────────────────────────────
// EventAggregate — agregado da Entidade 04 (EVENTO). Deriva EXCLUSIVAMENTE do
// Livro Mestre. (Nome com sufixo "Aggregate" para não colidir com o `Event` do DOM.)
//
// O que esta entidade FAZ (e só isto):
//   • RECONHECE (nunca inventa) um acontecimento — fábrica `recognize`, emite
//     EventRecognized (Lei Epistemológica nº 1);
//   • registra a classificação FORNECIDA — Relevante ou Informativo (INV-EV-01;
//     DF-14) — e recusa Relevante sem Fato (INV-EV-03; E12-L09);
//   • vincula a exatamente uma Missão (INV-EV-04; Lei 2);
//   • guarda esses elementos de forma imutável.
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO altera Estado Operacional por si só (INV-EV-02) — sem estado, sem método;
//   • NÃO constrói Verdade Operacional — sem síntese;
//   • NÃO decide nem interpreta — a relevância é FORNECIDA (teste do R4), não
//     decidida aqui; a entidade só recusa combinação inválida (INV-EV-03);
//   • NÃO implementa workflow nem processamento;
//   • NÃO conhece Documento/Pessoa/Processo/Caso; só referencia Missão, Fato e
//     responsável, por identidade (DF-18).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { EventId } from './event-id.js';
import type { EventMissionRef, FactRef, EventRecognitionResponsibleRef } from './refs.js';
import { EventClassification } from './event-classification.js';
import type { EventClassificationValue } from './event-classification.js';
import { EventRecognized } from './event-events.js';

/** Entrada de reconhecimento do Evento (Entidade 04; DF-14; E12-L09). */
export interface EventRecognitionInput {
  readonly id: EventId;
  readonly classification: EventClassificationValue; // Relevante | Informativo (INV-EV-01)
  readonly mission: EventMissionRef; // exatamente uma (INV-EV-04)
  readonly fact?: FactRef; // obrigatório se Relevante (INV-EV-03)
  readonly occurredAt: Date; // quando ocorreu na Realidade
  readonly recognizedAt: Date; // quando foi reconhecido pelo Sistema
  readonly recognizedBy: EventRecognitionResponsibleRef; // responsável (Art. 14º; R4)
}

interface EventProps {
  readonly id: EventId;
  readonly classification: EventClassification;
  readonly mission: EventMissionRef;
  readonly fact: FactRef | null;
  readonly occurredAt: Date;
  readonly recognizedAt: Date;
  readonly recognizedBy: EventRecognitionResponsibleRef;
}

const CANON_REF = 'Entidade 04 — EVENTO';
const TRACE_ID = 'EVENTO-RASTREABILIDADE';
const TRACE_REF = 'Lei 3; Art. 14º; R4 (efetivação por responsável)';

export class EventAggregate extends AggregateRoot<EventId> {
  private constructor(private readonly props: EventProps) {
    super(props.id);
  }

  /** Reconhece oficialmente um acontecimento (Lei Epistemológica nº 1). */
  static recognize(input: EventRecognitionInput): Result<EventAggregate, CanonViolationError> {
    // INV-EV-04 — vinculado a exatamente uma Missão (presença).
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-EV-04',
          canonReference: `${CANON_REF}; INV-EV-04; Lei 2`,
          message: 'O Evento deve ser vinculado a exatamente uma Missão (INV-EV-04).',
        }),
      );
    }
    // Rastreabilidade do reconhecimento — responsável e momentos (Lei 3; Art. 14º).
    if (input.recognizedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRACE_ID,
          canonReference: TRACE_REF,
          message: 'Reconhecimento de Evento sem responsável identificado.',
        }),
      );
    }
    if (!(input.occurredAt instanceof Date) || Number.isNaN(input.occurredAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRACE_ID,
          canonReference: TRACE_REF,
          message: 'Evento sem momento de ocorrência válido.',
        }),
      );
    }
    if (!(input.recognizedAt instanceof Date) || Number.isNaN(input.recognizedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRACE_ID,
          canonReference: TRACE_REF,
          message: 'Evento sem momento de reconhecimento válido.',
        }),
      );
    }
    // INV-EV-01 — classificação válida (Relevante | Informativo).
    const classification = EventClassification.create(input.classification);
    if (classification.isErr()) {
      return Result.err(classification.unwrapErr());
    }
    // INV-EV-03 — Evento Relevante exige Fato reconhecido.
    const fact = input.fact ?? null;
    if (classification.unwrap().isRelevant() && fact == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-EV-03',
          canonReference: `${CANON_REF}; INV-EV-03; E12-L09`,
          message: 'Evento Relevante exige um Fato reconhecido que o fundamente (E12-L09).',
        }),
      );
    }

    const event = new EventAggregate({
      id: input.id,
      classification: classification.unwrap(),
      mission: input.mission,
      fact,
      occurredAt: new Date(input.occurredAt.getTime()),
      recognizedAt: new Date(input.recognizedAt.getTime()),
      recognizedBy: input.recognizedBy,
    });

    event.addDomainEvent(new EventRecognized(input.id.toString(), event.props.recognizedAt));
    return Result.ok(event);
  }

  // Acessores imutáveis. Nenhum método de alteração de estado, síntese de Verdade,
  // decisão, interpretação ou processamento (INV-EV-02; princípios do fundador).
  get classification(): EventClassification {
    return this.props.classification;
  }
  get mission(): EventMissionRef {
    return this.props.mission;
  }
  /** Fato que fundamenta o Evento Relevante; null para Informativo (INV-EV-03). */
  get fact(): FactRef | null {
    return this.props.fact;
  }
  get occurredAt(): Date {
    return new Date(this.props.occurredAt.getTime());
  }
  get recognizedAt(): Date {
    return new Date(this.props.recognizedAt.getTime());
  }
  get recognizedBy(): EventRecognitionResponsibleRef {
    return this.props.recognizedBy;
  }
}
