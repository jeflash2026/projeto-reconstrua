// ─────────────────────────────────────────────────────────────────────────────
// AdvogadoAggregate — agregado da Entidade 17 (ADVOGADO). Deriva EXCLUSIVAMENTE do
// Livro Mestre (Entidade 17; DF-09; DF-10; DF-12; Art. 10º/12º/14º; R7 como
// contexto — não execução; Lei Geral).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA a designação de uma Pessoa como Advogado de uma Missão — fábrica
//     `designate`, emite AdvogadoDesignated (item 7; DF-12);
//   • vincula a Pessoa (02) que exerce o papel (item 1) e a Missão (01) sobre a
//     qual atua (INV-AD-03; item 11/18);
//   • registra a autoridade designante (DF-12) e a datação (Art. 12º/14º).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO executa a decisão jurídica nem assina — isso é ato HUMANO do advogado
//     (competência privativa; item 12/16); a entidade só representa a designação;
//   • NÃO pratica perícia (não é perito — item 4) — SEM método;
//   • NÃO conduz a operação diária (não é operador — item 4) — SEM método;
//   • NÃO cria Verdade (a Verdade nasce do Conhecimento — E8) — SEM método;
//   • NÃO altera diretamente o Estado (o Estado deriva da Verdade via R6/Evento
//     Relevante — INV-EO-02/04) — SEM método;
//   • NÃO detém titularidade da Missão (item 13; INV-AD-03) — só a referencia;
//   • NÃO conhece PROCESSO/CASO por identidade (atuação → OPERAÇÃO/R7; recomendação R1);
//   • NÃO executa a transição de designação (INV-AD-03/Art. 12º é use-case).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { AdvogadoId } from './advogado-id.js';
import type { AdvogadoPersonRef, AdvogadoMissionRef, AdvogadoAuthorityRef } from './refs.js';
import { AdvogadoDesignated } from './advogado-events.js';

/** Entrada de designação do Advogado (Entidade 17; itens 1/7/11). */
export interface AdvogadoDesignationInput {
  readonly id: AdvogadoId;
  readonly person: AdvogadoPersonRef; // a pessoa que exerce o papel (item 1)
  readonly mission: AdvogadoMissionRef; // a missão sobre a qual atua (INV-AD-03)
  readonly designatedBy: AdvogadoAuthorityRef; // autoridade da Governança (DF-12)
  readonly designatedAt: Date; // datação (Art. 12º/14º)
}

interface AdvogadoProps {
  readonly id: AdvogadoId;
  readonly person: AdvogadoPersonRef;
  readonly mission: AdvogadoMissionRef;
  readonly designatedBy: AdvogadoAuthorityRef;
  readonly designatedAt: Date;
}

const PERSON_ID = 'AD-PESSOA';
const PERSON_REF = 'Entidade 17; item 1';
const MISSION_ID = 'INV-AD-03';
const MISSION_REF = 'Entidade 17; INV-AD-03; item 11/18';
const AUTH_ID = 'AD-AUTORIZADO';
const AUTH_REF = 'Entidade 17; item 7/8/11; DF-12';
const DATE_ID = 'AD-DATADO';
const DATE_REF = 'Entidade 17; Art. 12º/14º';

export class AdvogadoAggregate extends AggregateRoot<AdvogadoId> {
  private constructor(private readonly props: AdvogadoProps) {
    super(props.id);
  }

  /**
   * Materializa a designação de uma Pessoa como Advogado de uma Missão (item 7;
   * DF-12). NÃO executa decisão jurídica nem assina: assembla o marco imutável
   * (pessoa + missão + autoridade) e valida a boa-formação.
   */
  static designate(input: AdvogadoDesignationInput): Result<AdvogadoAggregate, CanonViolationError> {
    // item 1 — a pessoa que exerce o papel.
    if (input.person == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: PERSON_ID,
          canonReference: PERSON_REF,
          message: 'O Advogado é uma Pessoa (o profissional); a Pessoa é obrigatória (item 1).',
        }),
      );
    }
    // INV-AD-03 — atua sobre exatamente uma Missão (que pertence ao Projeto).
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: MISSION_ID,
          canonReference: MISSION_REF,
          message: 'O Advogado atua sobre uma Missão; a Missão é obrigatória (INV-AD-03).',
        }),
      );
    }
    // DF-12 — autoridade designante (autorização da Governança).
    if (input.designatedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: AUTH_ID,
          canonReference: AUTH_REF,
          message: 'Designação de Advogado sem autoridade designante identificada (DF-12).',
        }),
      );
    }
    // Datação — temporalidade/rastreabilidade (Art. 12º/14º).
    if (!(input.designatedAt instanceof Date) || Number.isNaN(input.designatedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: DATE_ID,
          canonReference: DATE_REF,
          message: 'Designação de Advogado sem datação válida (Art. 14º).',
        }),
      );
    }

    const advogado = new AdvogadoAggregate({
      id: input.id,
      person: input.person,
      mission: input.mission,
      designatedBy: input.designatedBy,
      designatedAt: new Date(input.designatedAt.getTime()),
    });

    advogado.addDomainEvent(new AdvogadoDesignated(input.id.toString(), advogado.props.designatedAt));
    return Result.ok(advogado);
  }

  // Acessores imutáveis. NENHUM método de execução de decisão, assinatura, perícia,
  // condução operacional, criação de Verdade, alteração de Estado ou titularidade
  // (INV-AD-01/02/03; itens 4/13/16).
  get person(): AdvogadoPersonRef {
    return this.props.person;
  }
  get mission(): AdvogadoMissionRef {
    return this.props.mission;
  }
  get designatedBy(): AdvogadoAuthorityRef {
    return this.props.designatedBy;
  }
  get designatedAt(): Date {
    return new Date(this.props.designatedAt.getTime());
  }
}
