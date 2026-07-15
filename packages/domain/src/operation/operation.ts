// ─────────────────────────────────────────────────────────────────────────────
// OperationAggregate — agregado da Entidade 11 (OPERAÇÃO). Deriva EXCLUSIVAMENTE
// do Livro Mestre (Entidade 11; DF-08; DF-13; Volume 03; Lei 4; Art. 14º; CA-13).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA o marco ontológico de uma Operação conduzida em função de uma
//     missão — fábrica `conduct`, emite OperationConducted (item 1);
//   • vincula a Operação a exatamente uma Missão em função da qual existe
//     (INV-OP-01; item 11; DF-08);
//   • registra a rastreabilidade que a torna auditável — responsável + datação
//     (INV-OP-03; R9; Lei 4; Art. 14º).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO executa R1–R9 nem qualquer Regra Operacional (INV-OP-02 é use-case) —
//     sem workflow, sem agir autônomo;
//   • NÃO possui a Missão, a Verdade nem a Pessoa (item 13) — só referencia;
//   • NÃO altera a Verdade nem o Estado (não os conhece) — sem mutadores;
//   • NÃO decide (decisão é do humano — DF-09; itens 16/17);
//   • NÃO substitui nem possui Processo/Caso (entidades distintas — itens 4/12);
//   • NÃO modela a coleção de ações/eventos (workflow — fora; item 12 "referencia,
//     não possui"); NÃO referencia a REGRA OPERACIONAL (12, posterior); NÃO
//     antecipa papéis (14–18)/AHRI (responsável é ponteiro genérico).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { OperationId } from './operation-id.js';
import type { OperationMissionRef, OperationResponsibleRef } from './refs.js';
import { OperationConducted } from './operation-events.js';

/** Entrada de condução da Operação (Entidade 11; itens 1/7/8/11). */
export interface OperationConductInput {
  readonly id: OperationId;
  readonly mission: OperationMissionRef; // em função de exatamente uma (INV-OP-01)
  readonly conductedBy: OperationResponsibleRef; // responsável/AHRI (INV-OP-03; Art. 14º)
  readonly conductedAt: Date; // datação (auditabilidade)
}

interface OperationProps {
  readonly id: OperationId;
  readonly mission: OperationMissionRef;
  readonly conductedBy: OperationResponsibleRef;
  readonly conductedAt: Date;
}

const MISSION_ID = 'INV-OP-01';
const MISSION_REF = 'Entidade 11; INV-OP-01; item 11; DF-08';
const AUDIT_ID = 'OP-AUDITAVEL';
const AUDIT_REF = 'Entidade 11; INV-OP-03; R9; Lei 4; Art. 14º';

export class OperationAggregate extends AggregateRoot<OperationId> {
  private constructor(private readonly props: OperationProps) {
    super(props.id);
  }

  /**
   * Materializa o marco de uma Operação conduzida em função de uma missão (item 1).
   * NÃO executa R1–R9: assembla o marco imutável e valida sua boa-formação
   * (missão, responsável, datação).
   */
  static conduct(input: OperationConductInput): Result<OperationAggregate, CanonViolationError> {
    // INV-OP-01 — existe em função de exatamente uma Missão.
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: MISSION_ID,
          canonReference: MISSION_REF,
          message: 'A Operação existe em função de uma Missão; a Missão é obrigatória (INV-OP-01).',
        }),
      );
    }
    // INV-OP-03 — auditabilidade: responsável identificado (Art. 14º; Lei 4).
    if (input.conductedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: AUDIT_ID,
          canonReference: AUDIT_REF,
          message: 'Operação sem responsável identificado (INV-OP-03; R9; Art. 14º).',
        }),
      );
    }
    // Datação — auditabilidade (Art. 14º).
    if (!(input.conductedAt instanceof Date) || Number.isNaN(input.conductedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: AUDIT_ID,
          canonReference: AUDIT_REF,
          message: 'Operação sem datação válida (auditabilidade; Art. 14º).',
        }),
      );
    }

    const operation = new OperationAggregate({
      id: input.id,
      mission: input.mission,
      conductedBy: input.conductedBy,
      conductedAt: new Date(input.conductedAt.getTime()),
    });

    operation.addDomainEvent(new OperationConducted(input.id.toString(), operation.props.conductedAt));
    return Result.ok(operation);
  }

  // Acessores imutáveis. Nenhum agir autônomo, mutador de Verdade/Estado, decisão
  // ou substituição de Processo/Caso (INV-OP-02; itens 13/16/17).
  get mission(): OperationMissionRef {
    return this.props.mission;
  }
  get conductedBy(): OperationResponsibleRef {
    return this.props.conductedBy;
  }
  get conductedAt(): Date {
    return new Date(this.props.conductedAt.getTime());
  }
}
