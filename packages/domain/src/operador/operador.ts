// ─────────────────────────────────────────────────────────────────────────────
// OperadorAggregate — agregado da Entidade 15 (OPERADOR). Deriva EXCLUSIVAMENTE do
// Livro Mestre (Entidade 15; DF-09; DF-10; DF-12; Art. 10º/12º/14º; R7 como
// contexto — não execução; Lei Geral).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA a designação de uma Pessoa como Operador de uma Missão — fábrica
//     `designate`, emite OperadorDesignated (item 7; DF-12);
//   • vincula a Pessoa (02) que exerce o papel (item 1) e a Missão (01) sobre a
//     qual atua (INV-OPr-01; item 11/18);
//   • registra a autoridade designante (DF-12) e a datação (Art. 12º/14º).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO conduz a operação — a condução diária é a OPERAÇÃO(11)/R7; a entidade só
//     representa a designação;
//   • NÃO pratica ato privativo de advogado/perito (INV-OPr-02; DF-09) — SEM método;
//   • NÃO decide juridicamente (item 17; DF-09) — SEM método;
//   • NÃO detém titularidade da Missão (item 13; INV-OPr-01) — só a referencia;
//   • NÃO aciona AHRI/Advogado/Perito (interação — OPERAÇÃO/R7; recomendação R1);
//   • NÃO executa a transição de designação (INV-OPr-03 é use-case).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { OperadorId } from './operador-id.js';
import type { OperadorPersonRef, OperadorMissionRef, OperadorAuthorityRef } from './refs.js';
import { OperadorDesignated } from './operador-events.js';

/** Entrada de designação do Operador (Entidade 15; itens 1/7/11). */
export interface OperadorDesignationInput {
  readonly id: OperadorId;
  readonly person: OperadorPersonRef; // a pessoa que exerce o papel (item 1)
  readonly mission: OperadorMissionRef; // a missão sobre a qual atua (INV-OPr-01)
  readonly designatedBy: OperadorAuthorityRef; // autoridade da Governança (DF-12)
  readonly designatedAt: Date; // datação (Art. 12º/14º)
}

interface OperadorProps {
  readonly id: OperadorId;
  readonly person: OperadorPersonRef;
  readonly mission: OperadorMissionRef;
  readonly designatedBy: OperadorAuthorityRef;
  readonly designatedAt: Date;
}

const PERSON_ID = 'OPr-PESSOA';
const PERSON_REF = 'Entidade 15; item 1';
const MISSION_ID = 'INV-OPr-01';
const MISSION_REF = 'Entidade 15; INV-OPr-01; item 11/18';
const AUTH_ID = 'OPr-AUTORIZADO';
const AUTH_REF = 'Entidade 15; item 7/8/11; DF-12';
const DATE_ID = 'OPr-DATADO';
const DATE_REF = 'Entidade 15; Art. 12º/14º';

export class OperadorAggregate extends AggregateRoot<OperadorId> {
  private constructor(private readonly props: OperadorProps) {
    super(props.id);
  }

  /**
   * Materializa a designação de uma Pessoa como Operador de uma Missão (item 7;
   * DF-12). NÃO conduz a operação: assembla o marco imutável (pessoa + missão +
   * autoridade) e valida a boa-formação.
   */
  static designate(input: OperadorDesignationInput): Result<OperadorAggregate, CanonViolationError> {
    // item 1 — a pessoa que exerce o papel.
    if (input.person == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: PERSON_ID,
          canonReference: PERSON_REF,
          message: 'O Operador é uma Pessoa; a Pessoa é obrigatória (item 1).',
        }),
      );
    }
    // INV-OPr-01 — atua sobre exatamente uma Missão (que pertence ao Projeto).
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: MISSION_ID,
          canonReference: MISSION_REF,
          message: 'O Operador atua sobre uma Missão; a Missão é obrigatória (INV-OPr-01).',
        }),
      );
    }
    // DF-12 — autoridade designante (autorização da Governança).
    if (input.designatedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: AUTH_ID,
          canonReference: AUTH_REF,
          message: 'Designação de Operador sem autoridade designante identificada (DF-12).',
        }),
      );
    }
    // Datação — temporalidade/rastreabilidade (Art. 12º/14º).
    if (!(input.designatedAt instanceof Date) || Number.isNaN(input.designatedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: DATE_ID,
          canonReference: DATE_REF,
          message: 'Designação de Operador sem datação válida (Art. 14º).',
        }),
      );
    }

    const operador = new OperadorAggregate({
      id: input.id,
      person: input.person,
      mission: input.mission,
      designatedBy: input.designatedBy,
      designatedAt: new Date(input.designatedAt.getTime()),
    });

    operador.addDomainEvent(new OperadorDesignated(input.id.toString(), operador.props.designatedAt));
    return Result.ok(operador);
  }

  // Acessores imutáveis. NENHUM método de ato privativo, decisão jurídica,
  // titularidade ou condução autônoma (INV-OPr-01/02; itens 13/17).
  get person(): OperadorPersonRef {
    return this.props.person;
  }
  get mission(): OperadorMissionRef {
    return this.props.mission;
  }
  get designatedBy(): OperadorAuthorityRef {
    return this.props.designatedBy;
  }
  get designatedAt(): Date {
    return new Date(this.props.designatedAt.getTime());
  }
}
