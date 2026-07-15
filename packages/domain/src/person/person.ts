// ─────────────────────────────────────────────────────────────────────────────
// Person — agregado da Entidade 02 (PESSOA). Deriva EXCLUSIVAMENTE do Livro Mestre.
//
// O que esta entidade FAZ (e só isto):
//   • RECONHECE (nunca cria) uma Pessoa preexistente — a fábrica chama-se
//     `recognize` e emite PersonRecognized (Lei do Reconhecimento; INV-P15);
//   • garante o reconhecimento completo — os seis elementos da DF-23 (INV-P14);
//   • guarda esses elementos de forma imutável (INV-P08: a representação jamais
//     altera a identidade civil).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon):
//   • NÃO possui Estado, Etapa, Workflow nem Timeline Operacional (INV-P03) — não
//     há tais campos;
//   • NÃO possui coleção de missões nem lógica de vínculo: a titularidade vive na
//     MISSÃO (DF-20; INV-17) e a visualização é projeção (INV-P10);
//   • NÃO é encerrada (INV-P13) — não há método de encerramento;
//   • NÃO valida "suficiência" de identidade/evidências nem "autorização" de
//     origem: isso é o caso de uso de Reconhecimento (R2)/Governança, não a entidade;
//   • NÃO atualiza cadastro (isso é caso de uso; INV-P09).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { PersonId } from './person-id.js';
import type { RecognitionResponsibleRef, EvidenceRef } from './refs.js';
import { CivilIdentity, RecognitionOrigin } from './value-objects.js';
import { PersonRecognized } from './person-events.js';

/** Entrada de reconhecimento (os seis elementos da DF-23). */
export interface PersonRecognitionInput {
  readonly id: PersonId; // elemento 1 — identificador único
  readonly civilIdentityText: string; // elemento 2 — identidade civil suficiente
  readonly originText: string; // elemento 3 — origem do reconhecimento
  readonly recognizedAt: Date; // elemento 4 — data do reconhecimento
  readonly responsible: RecognitionResponsibleRef; // elemento 5 — responsável
  readonly evidences: ReadonlyArray<EvidenceRef>; // elemento 6 — evidências utilizadas
}

interface PersonProps {
  readonly id: PersonId;
  readonly civilIdentity: CivilIdentity;
  readonly origin: RecognitionOrigin;
  readonly recognizedAt: Date;
  readonly responsible: RecognitionResponsibleRef;
  readonly evidences: ReadonlyArray<EvidenceRef>;
}

const CANON_REF = 'Entidade 02 — PESSOA; DF-23';

export class Person extends AggregateRoot<PersonId> {
  private constructor(private readonly props: PersonProps) {
    super(props.id);
  }

  /**
   * Reconhece oficialmente uma Pessoa preexistente (DF-23; Lei do Reconhecimento).
   * Retorna CanonViolationError('INV-P14') quando qualquer dos seis elementos falta.
   */
  static recognize(input: PersonRecognitionInput): Result<Person, CanonViolationError> {
    // INV-P14 — responsável presente (elemento 5).
    if (input.responsible == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-P14',
          canonReference: CANON_REF,
          message: 'Reconhecimento incompleto: responsável ausente (DF-23).',
        }),
      );
    }
    // INV-P14 — data de reconhecimento válida (elemento 4).
    if (!(input.recognizedAt instanceof Date) || Number.isNaN(input.recognizedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-P14',
          canonReference: CANON_REF,
          message: 'Reconhecimento incompleto: data de reconhecimento inválida (DF-23).',
        }),
      );
    }
    // INV-P14 — ao menos uma evidência utilizada (elemento 6).
    if (input.evidences == null || input.evidences.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-P14',
          canonReference: CANON_REF,
          message: 'Reconhecimento incompleto: nenhuma evidência utilizada (DF-23).',
        }),
      );
    }
    // INV-P14 — identidade civil presente (elemento 2).
    const civil = CivilIdentity.create(input.civilIdentityText);
    if (civil.isErr()) {
      return Result.err(civil.unwrapErr());
    }
    // INV-P14 — origem presente (elemento 3).
    const origin = RecognitionOrigin.create(input.originText);
    if (origin.isErr()) {
      return Result.err(origin.unwrapErr());
    }

    const person = new Person({
      id: input.id,
      civilIdentity: civil.unwrap(),
      origin: origin.unwrap(),
      recognizedAt: new Date(input.recognizedAt.getTime()),
      responsible: input.responsible,
      evidences: Object.freeze([...input.evidences]),
    });

    person.addDomainEvent(new PersonRecognized(input.id.toString(), person.props.recognizedAt));
    return Result.ok(person);
  }

  // Acessores imutáveis dos seis elementos. Nenhum acessor de estado/etapa/missões
  // (INV-P03), nenhum método de encerramento (INV-P13), nenhuma titularidade (INV-P05).
  get civilIdentity(): CivilIdentity {
    return this.props.civilIdentity;
  }
  get origin(): RecognitionOrigin {
    return this.props.origin;
  }
  get recognizedAt(): Date {
    return new Date(this.props.recognizedAt.getTime());
  }
  get responsible(): RecognitionResponsibleRef {
    return this.props.responsible;
  }
  get evidences(): ReadonlyArray<EvidenceRef> {
    return this.props.evidences;
  }
}
