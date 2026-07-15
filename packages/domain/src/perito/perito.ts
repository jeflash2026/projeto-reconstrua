// ─────────────────────────────────────────────────────────────────────────────
// PeritoAggregate — agregado da Entidade 16 (PERITO). Deriva EXCLUSIVAMENTE do
// Livro Mestre (Entidade 16; DF-09; DF-10; DF-12; DF-17; Art. 10º/12º/14º; R7 como
// contexto — não execução; Lei Geral).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA a designação de uma Pessoa como Perito, numa fase pericial
//     (PERÍCIA 13) de uma Missão — fábrica `designate`, emite PeritoDesignated;
//   • vincula a Pessoa (02) que exerce o papel (item 1), a Missão (01) (INV-PT-03)
//     e a PERÍCIA (13) em que atua (item 11/18);
//   • registra a autoridade designante (DF-12) e a datação (Art. 12º/14º).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO produz a prova técnica nem executa a perícia — isso é ato HUMANO do
//     perito; a entidade só representa a designação;
//   • NÃO produz Documentos automaticamente — o laudo reconhecido é DOCUMENTO (03);
//   • NÃO é a PERÍCIA (etapa) — INV-PT-02; DF-17; SEM atributos de etapa;
//   • NÃO pratica ato privativo de ADVOCACIA nem decide juridicamente (item 13/17);
//   • NÃO detém titularidade da Missão (item 13; INV-PT-03) — só a referencia;
//   • NÃO cria Verdade — a prova vira evidência (E2) que alimenta a Verdade (E8);
//   • NÃO executa a transição de designação (INV-PT-03/Art. 12º é use-case).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { PeritoId } from './perito-id.js';
import type {
  PeritoPersonRef,
  PeritoMissionRef,
  PeritoExpertiseRef,
  PeritoAuthorityRef,
} from './refs.js';
import { PeritoDesignated } from './perito-events.js';

/** Entrada de designação do Perito (Entidade 16; itens 1/7/11/18). */
export interface PeritoDesignationInput {
  readonly id: PeritoId;
  readonly person: PeritoPersonRef; // a pessoa que exerce o papel (item 1)
  readonly mission: PeritoMissionRef; // a missão sobre a qual atua (INV-PT-03)
  readonly expertise: PeritoExpertiseRef; // a fase PERÍCIA (13) em que atua (item 11/18)
  readonly designatedBy: PeritoAuthorityRef; // autoridade da Governança (DF-12)
  readonly designatedAt: Date; // datação (Art. 12º/14º)
}

interface PeritoProps {
  readonly id: PeritoId;
  readonly person: PeritoPersonRef;
  readonly mission: PeritoMissionRef;
  readonly expertise: PeritoExpertiseRef;
  readonly designatedBy: PeritoAuthorityRef;
  readonly designatedAt: Date;
}

const PERSON_ID = 'PT-PESSOA';
const PERSON_REF = 'Entidade 16; item 1';
const MISSION_ID = 'INV-PT-03';
const MISSION_REF = 'Entidade 16; INV-PT-03; item 18';
const EXPERTISE_ID = 'PT-ATUA-NA-PERICIA';
const EXPERTISE_REF = 'Entidade 16; item 11/18; INV-PT-02; DF-17';
const AUTH_ID = 'PT-AUTORIZADO';
const AUTH_REF = 'Entidade 16; item 7/8; DF-12';
const DATE_ID = 'PT-DATADO';
const DATE_REF = 'Entidade 16; Art. 12º/14º';

export class PeritoAggregate extends AggregateRoot<PeritoId> {
  private constructor(private readonly props: PeritoProps) {
    super(props.id);
  }

  /**
   * Materializa a designação de uma Pessoa como Perito numa fase pericial (item 7;
   * DF-12). NÃO produz a prova nem executa a perícia: assembla o marco imutável
   * (pessoa + missão + perícia + autoridade) e valida a boa-formação.
   */
  static designate(input: PeritoDesignationInput): Result<PeritoAggregate, CanonViolationError> {
    // item 1 — a pessoa que exerce o papel.
    if (input.person == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: PERSON_ID,
          canonReference: PERSON_REF,
          message: 'O Perito é uma Pessoa (o profissional); a Pessoa é obrigatória (item 1).',
        }),
      );
    }
    // INV-PT-03 — atua sobre exatamente uma Missão (que pertence ao Projeto).
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: MISSION_ID,
          canonReference: MISSION_REF,
          message: 'O Perito atua sobre uma Missão; a Missão é obrigatória (INV-PT-03).',
        }),
      );
    }
    // item 11/18 — atua numa fase PERÍCIA (13); atua na etapa, não é a etapa (INV-PT-02).
    if (input.expertise == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: EXPERTISE_ID,
          canonReference: EXPERTISE_REF,
          message: 'O Perito atua numa fase pericial (PERÍCIA 13); a Perícia é obrigatória (item 11/18).',
        }),
      );
    }
    // DF-12 — autoridade designante (autorização da Governança).
    if (input.designatedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: AUTH_ID,
          canonReference: AUTH_REF,
          message: 'Designação de Perito sem autoridade designante identificada (DF-12).',
        }),
      );
    }
    // Datação — temporalidade/rastreabilidade (Art. 12º/14º).
    if (!(input.designatedAt instanceof Date) || Number.isNaN(input.designatedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: DATE_ID,
          canonReference: DATE_REF,
          message: 'Designação de Perito sem datação válida (Art. 14º).',
        }),
      );
    }

    const perito = new PeritoAggregate({
      id: input.id,
      person: input.person,
      mission: input.mission,
      expertise: input.expertise,
      designatedBy: input.designatedBy,
      designatedAt: new Date(input.designatedAt.getTime()),
    });

    perito.addDomainEvent(new PeritoDesignated(input.id.toString(), perito.props.designatedAt));
    return Result.ok(perito);
  }

  // Acessores imutáveis. NENHUM método de produção de prova, execução de perícia,
  // ato privativo de advocacia, decisão jurídica, titularidade ou "ser a etapa"
  // (INV-PT-01/02/03; itens 13/16/17).
  get person(): PeritoPersonRef {
    return this.props.person;
  }
  get mission(): PeritoMissionRef {
    return this.props.mission;
  }
  /** A fase PERÍCIA (13) em que o Perito atua (item 11/18) — referência, não identidade da etapa. */
  get expertise(): PeritoExpertiseRef {
    return this.props.expertise;
  }
  get designatedBy(): PeritoAuthorityRef {
    return this.props.designatedBy;
  }
  get designatedAt(): Date {
    return new Date(this.props.designatedAt.getTime());
  }
}
