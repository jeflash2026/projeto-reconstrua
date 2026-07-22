// ─────────────────────────────────────────────────────────────────────────────
// OperationalStageAggregate — agregado da Entidade 09 (ETAPA OPERACIONAL).
// Deriva EXCLUSIVAMENTE do Livro Mestre (Entidade 09; DF-08; DF-17; Lei 1; Lei 2;
// INV-ET-01..03). Encerra o Núcleo Cognitivo.
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA a representação visual de um Estado — fábrica `represent`, emite
//     OperationalStageRepresented (item 1: "representação visual do Estado");
//   • aponta o Estado (08) que representa, como correspondência ÚNICA e 1:1
//     (INV-ET-01; item 11);
//   • preserva a forma apresentável do Estado (itens 2/3/19; Art. 11º) — imutável;
//   • é datada (unicidade por instante — INV-ET-03).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO altera o Estado (item 16; INV-ET-02) — sem mutadores;
//   • NÃO altera nem produz a Verdade (itens 4/17) — não a conhece;
//   • NÃO é fonte de verdade nem de estado (item 17; DF-08) — sem campo-fonte;
//   • NÃO diverge do Estado (INV-ET-02) — só referencia e apresenta;
//   • NÃO executa R5 (síntese) nem R6 (evolução) — só materializa a representação;
//   • NÃO modela a MISSÃO (transitiva via Estado) nem a PERÍCIA (13, posterior —
//     Lei da Definição Local);
//   • NÃO decide; NÃO recalcula; NÃO é produzida como fonte por interface (DF-08).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { OperationalStageId } from './operational-stage-id.js';
import type { RepresentedStateRef } from './refs.js';
import { StageForm } from './value-objects.js';
import { OperationalStageRepresented } from './operational-stage-events.js';

/** Entrada de representação da Etapa (Entidade 09; itens 1/2/7/11). */
export interface OperationalStageRepresentationInput {
  readonly id: OperationalStageId;
  readonly representedState: RepresentedStateRef; // exatamente um Estado (INV-ET-01; 1:1)
  readonly form: string; // forma apresentável (itens 2/3/19)
  readonly presentedAt: Date; // datação (unicidade por instante)
}

interface OperationalStageProps {
  readonly id: OperationalStageId;
  readonly representedState: RepresentedStateRef;
  readonly form: StageForm;
  readonly presentedAt: Date;
}

const STATE_ID = 'INV-ET-01';
const STATE_REF = 'Entidade 09; INV-ET-01; item 11; mapeamento 1:1';
const DATE_ID = 'ET-DATADA';
const DATE_REF = 'Entidade 09, item 14 (unicidade por instante); Art. 14º';

export class OperationalStageAggregate extends AggregateRoot<OperationalStageId> {
  private constructor(private readonly props: OperationalStageProps) {
    super(props.id);
  }

  /**
   * Materializa a representação visual de um Estado (item 1). NÃO executa R5/R6 e
   * NÃO altera o Estado: assembla o snapshot imutável e valida sua boa-formação
   * (correspondência ao Estado, forma apresentável, datação).
   */
  static represent(
    input: OperationalStageRepresentationInput,
  ): Result<OperationalStageAggregate, CanonViolationError> {
    // INV-ET-01 — corresponde a exatamente um Estado (1:1); referência obrigatória.
    if (input.representedState == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: STATE_ID,
          canonReference: STATE_REF,
          message:
            'A Etapa corresponde a exatamente um Estado; o Estado representado é obrigatório (INV-ET-01).',
        }),
      );
    }
    // Datação — unicidade por instante (Art. 14º).
    if (!(input.presentedAt instanceof Date) || Number.isNaN(input.presentedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: DATE_ID,
          canonReference: DATE_REF,
          message: 'A Etapa é representada sem datação válida (unicidade por instante).',
        }),
      );
    }
    // Forma apresentável do Estado (itens 2/3/19).
    const form = StageForm.create(input.form);
    if (form.isErr()) {
      return Result.err(form.unwrapErr());
    }

    const stage = new OperationalStageAggregate({
      id: input.id,
      representedState: input.representedState,
      form: form.unwrap(),
      presentedAt: new Date(input.presentedAt.getTime()),
    });

    stage.addDomainEvent(
      new OperationalStageRepresented(input.id.toString(), stage.props.presentedAt),
    );
    return Result.ok(stage);
  }

  // Acessores imutáveis. Nenhum mutador, fonte de verdade/estado, recálculo ou
  // decisão (item 16/17; INV-ET-02).
  get representedState(): RepresentedStateRef {
    return this.props.representedState;
  }
  get form(): StageForm {
    return this.props.form;
  }
  get presentedAt(): Date {
    return new Date(this.props.presentedAt.getTime());
  }
}
