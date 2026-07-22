// ─────────────────────────────────────────────────────────────────────────────
// ProjectionAggregate — agregado da Entidade 10 (PROJEÇÃO). Deriva EXCLUSIVAMENTE
// do Livro Mestre (Entidade 10; DF-03; DF-08; INV-E8-04; E4-L08; Lei 1).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA uma leitura DERIVADA da Verdade — fábrica `derive`, emite
//     ProjectionDerived (item 1: "leitura derivada da Verdade Operacional");
//   • aponta a Verdade (07) da qual deriva, como fonte ÚNICA e obrigatória
//     (INV-PJ-01; item 11; DF-03);
//   • preserva a leitura derivada, SEMPRE declarada como derivada (itens 3/19) —
//     imutável;
//   • é datada (cada leitura é um instantâneo recalculável — item 8/9).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO substitui, reinterpreta ou recalcula a Verdade como verdade (INV-PJ-01;
//     DF-03; INV-E8-04) — sem qualquer mutador da Verdade;
//   • NÃO altera o Estado (INV-PJ-02; DF-08) — não conhece nem referencia o Estado;
//   • NÃO altera a Etapa (item 13) — não a conhece;
//   • NÃO decide nem constitui verdade (itens 4/5/16) — só informa;
//   • NÃO é apresentada como verdade/score-verdade (item 17; E4-L08);
//   • NÃO calcula a métrica (isso é Regra Operacional/DF-13) nem agrega leituras
//     multi-missão (projeção de leitura — fora); NÃO modela a MISSÃO (transitiva
//     via a Verdade).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { ProjectionId } from './projection-id.js';
import type { ProjectionTruthRef } from './refs.js';
import { DerivedReading } from './value-objects.js';
import { ProjectionDerived } from './projection-events.js';

/** Entrada de derivação da Projeção (Entidade 10; itens 1/3/11). */
export interface ProjectionDerivationInput {
  readonly id: ProjectionId;
  readonly derivedFromTruth: ProjectionTruthRef; // fonte exclusiva (INV-PJ-01; item 11)
  readonly reading: string; // leitura derivada (itens 3/19)
  readonly calculatedAt: Date; // datação (recalculável — item 8/9)
}

interface ProjectionProps {
  readonly id: ProjectionId;
  readonly derivedFromTruth: ProjectionTruthRef;
  readonly reading: DerivedReading;
  readonly calculatedAt: Date;
}

const TRUTH_ID = 'INV-PJ-01';
const TRUTH_REF = 'Entidade 10; INV-PJ-01; item 11; DF-03';
const DATE_ID = 'PJ-DATADA';
const DATE_REF = 'Entidade 10, item 14 (recalculabilidade); Art. 14º';

export class ProjectionAggregate extends AggregateRoot<ProjectionId> {
  private constructor(private readonly props: ProjectionProps) {
    super(props.id);
  }

  /**
   * Materializa uma leitura derivada da Verdade (item 1). NÃO calcula a métrica e
   * NÃO altera a Verdade/Estado: assembla o snapshot imutável e valida sua
   * boa-formação (derivação, leitura, datação).
   */
  static derive(
    input: ProjectionDerivationInput,
  ): Result<ProjectionAggregate, CanonViolationError> {
    // INV-PJ-01 — deriva da Verdade Operacional (fonte obrigatória e exclusiva).
    if (input.derivedFromTruth == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRUTH_ID,
          canonReference: TRUTH_REF,
          message:
            'A Projeção deriva exclusivamente da Verdade; a Verdade de origem é obrigatória (INV-PJ-01).',
        }),
      );
    }
    // Datação — cada leitura é um instantâneo recalculável (Art. 14º).
    if (!(input.calculatedAt instanceof Date) || Number.isNaN(input.calculatedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: DATE_ID,
          canonReference: DATE_REF,
          message: 'A Projeção é derivada sem datação válida (recalculabilidade).',
        }),
      );
    }
    // Leitura derivada, declarada como derivada (itens 3/19).
    const reading = DerivedReading.create(input.reading);
    if (reading.isErr()) {
      return Result.err(reading.unwrapErr());
    }

    const projection = new ProjectionAggregate({
      id: input.id,
      derivedFromTruth: input.derivedFromTruth,
      reading: reading.unwrap(),
      calculatedAt: new Date(input.calculatedAt.getTime()),
    });

    projection.addDomainEvent(
      new ProjectionDerived(input.id.toString(), projection.props.calculatedAt),
    );
    return Result.ok(projection);
  }

  // Acessores imutáveis. Nenhum mutador da Verdade/Estado/Etapa, decisão ou
  // apresentação como verdade (INV-PJ-01/02; itens 16/17).
  get derivedFromTruth(): ProjectionTruthRef {
    return this.props.derivedFromTruth;
  }
  get reading(): DerivedReading {
    return this.props.reading;
  }
  get calculatedAt(): Date {
    return new Date(this.props.calculatedAt.getTime());
  }
}
