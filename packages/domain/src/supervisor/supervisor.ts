// ─────────────────────────────────────────────────────────────────────────────
// SupervisorAggregate — agregado da Entidade 18 (SUPERVISOR). Deriva EXCLUSIVAMENTE
// do Livro Mestre (Entidade 18; DF-09; DF-12; Art. 10º/12º/14º; R7 como contexto —
// não execução; Lei 4; Lei Geral).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA a designação de uma Pessoa como Supervisor de uma Missão —
//     fábrica `designate`, emite SupervisorDesignated (item 7; DF-12);
//   • vincula a Pessoa (02) que exerce o papel (item 2) e a Missão (01) sobre a
//     qual supervisiona (INV-SU-02; item 18);
//   • registra a autoridade designante (DF-12) e a datação (Art. 12º/14º).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO executa a supervisão (verificar conformidade/acionar correções é R7);
//   • NÃO cria ato privativo, NÃO pratica advocacia nem perícia (INV-SU-01; item 4/13);
//   • NÃO decide juridicamente (item 17; DF-09) — SEM método;
//   • NÃO conduz a operação (não é operador) — SEM método;
//   • NÃO produz prova técnica (não é perito) — SEM método;
//   • NÃO cria Verdade (E8) nem altera diretamente o Estado (INV-EO-02/04);
//   • NÃO detém titularidade da Missão (item 13; INV-SU-02) — só a referencia;
//   • NÃO conhece os papéis supervisionados (14–17) por identidade (supervisão →
//     OPERAÇÃO/R7; recomendação R1);
//   • NÃO modela os critérios de supervisão (INV-SU-03 → Governança/DF-12).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { SupervisorId } from './supervisor-id.js';
import type { SupervisorPersonRef, SupervisorMissionRef, SupervisorAuthorityRef } from './refs.js';
import { SupervisorDesignated } from './supervisor-events.js';

/** Entrada de designação do Supervisor (Entidade 18; itens 2/7/11/18). */
export interface SupervisorDesignationInput {
  readonly id: SupervisorId;
  readonly person: SupervisorPersonRef; // a pessoa que exerce o papel (item 2)
  readonly mission: SupervisorMissionRef; // a missão sobre a qual supervisiona (INV-SU-02)
  readonly designatedBy: SupervisorAuthorityRef; // autoridade da Governança (DF-12)
  readonly designatedAt: Date; // datação (Art. 12º/14º)
}

interface SupervisorProps {
  readonly id: SupervisorId;
  readonly person: SupervisorPersonRef;
  readonly mission: SupervisorMissionRef;
  readonly designatedBy: SupervisorAuthorityRef;
  readonly designatedAt: Date;
}

const PERSON_ID = 'SU-PESSOA';
const PERSON_REF = 'Entidade 18; item 2';
const MISSION_ID = 'INV-SU-02';
const MISSION_REF = 'Entidade 18; INV-SU-02; item 18';
const AUTH_ID = 'SU-AUTORIZADO';
const AUTH_REF = 'Entidade 18; item 7/8/11; DF-12';
const DATE_ID = 'SU-DATADO';
const DATE_REF = 'Entidade 18; Art. 12º/14º';

export class SupervisorAggregate extends AggregateRoot<SupervisorId> {
  private constructor(private readonly props: SupervisorProps) {
    super(props.id);
  }

  /**
   * Materializa a designação de uma Pessoa como Supervisor de uma Missão (item 7;
   * DF-12). NÃO executa a supervisão: assembla o marco imutável (pessoa + missão +
   * autoridade) e valida a boa-formação.
   */
  static designate(input: SupervisorDesignationInput): Result<SupervisorAggregate, CanonViolationError> {
    // item 2 — a pessoa que exerce o papel.
    if (input.person == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: PERSON_ID,
          canonReference: PERSON_REF,
          message: 'O Supervisor é uma Pessoa (papel humano); a Pessoa é obrigatória (item 2).',
        }),
      );
    }
    // INV-SU-02 — supervisiona exatamente uma Missão (que pertence ao Projeto).
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: MISSION_ID,
          canonReference: MISSION_REF,
          message: 'O Supervisor supervisiona uma Missão; a Missão é obrigatória (INV-SU-02).',
        }),
      );
    }
    // DF-12 — autoridade designante (autorização da Governança).
    if (input.designatedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: AUTH_ID,
          canonReference: AUTH_REF,
          message: 'Designação de Supervisor sem autoridade designante identificada (DF-12).',
        }),
      );
    }
    // Datação — temporalidade/rastreabilidade (Art. 12º/14º).
    if (!(input.designatedAt instanceof Date) || Number.isNaN(input.designatedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: DATE_ID,
          canonReference: DATE_REF,
          message: 'Designação de Supervisor sem datação válida (Art. 14º).',
        }),
      );
    }

    const supervisor = new SupervisorAggregate({
      id: input.id,
      person: input.person,
      mission: input.mission,
      designatedBy: input.designatedBy,
      designatedAt: new Date(input.designatedAt.getTime()),
    });

    supervisor.addDomainEvent(new SupervisorDesignated(input.id.toString(), supervisor.props.designatedAt));
    return Result.ok(supervisor);
  }

  // Acessores imutáveis. NENHUM método de ato privativo, decisão jurídica, condução,
  // produção de prova, criação de Verdade, alteração de Estado ou titularidade
  // (INV-SU-01/02; itens 4/13/17).
  get person(): SupervisorPersonRef {
    return this.props.person;
  }
  get mission(): SupervisorMissionRef {
    return this.props.mission;
  }
  get designatedBy(): SupervisorAuthorityRef {
    return this.props.designatedBy;
  }
  get designatedAt(): Date {
    return new Date(this.props.designatedAt.getTime());
  }
}
