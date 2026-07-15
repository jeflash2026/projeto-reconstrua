// ─────────────────────────────────────────────────────────────────────────────
// Mission — agregado da Entidade 01 (MISSÃO). Deriva EXCLUSIVAMENTE do Livro Mestre.
//
// O que esta entidade FAZ (e só isto):
//   • garante que a Missão não pode existir malformada — os sete elementos de
//     nascimento (DF-19; INV-18), exatamente uma Pessoa (DF-20; INV-17) e um
//     responsável operacional inicial (Art. 10º; INV-06);
//   • semeia o histórico inicial emitindo MissionCreated (DF-19, elemento 7);
//   • guarda seus elementos de nascimento de forma imutável.
//
// O que esta entidade NÃO faz (por fidelidade ao Canon):
//   • NÃO possui nem muda "estado operacional": o estado deriva EXCLUSIVAMENTE da
//     Verdade Operacional (INV-02; DF-08) e só muda por Evento Relevante (INV-08;
//     DF-05) — mecanismos de sprints futuras. Um setter de estado aqui violaria o
//     Canon;
//   • NÃO evolui, NÃO encerra, NÃO valida legitimidade de fundamento (INV-19 é do
//     caso de uso R1). Isso são casos de uso/regras operacionais — fora deste sprint.
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { MissionId } from './mission-id.js';
import type { BeneficiaryPersonRef, InitialOperationalResponsibleRef } from './refs.js';
import { InitialObjective, OpeningReason } from './value-objects.js';
import { MissionCreated } from './mission-events.js';

/** Entrada de nascimento (os elementos 1–6 de DF-19; o elemento 7 é o evento emitido). */
export interface MissionBirthInput {
  readonly id: MissionId; // elemento 1 — identificador único
  readonly beneficiary: BeneficiaryPersonRef; // elemento 2 — Pessoa beneficiária (INV-17)
  readonly initialObjectiveText: string; // elemento 3 — objetivo inicial
  readonly openingReasonText: string; // elemento 4 — motivo de abertura
  readonly initialResponsible: InitialOperationalResponsibleRef; // elemento 5 — responsável (INV-06)
  readonly createdAt: Date; // elemento 6 — data de criação
}

interface MissionProps {
  readonly id: MissionId;
  readonly beneficiary: BeneficiaryPersonRef;
  readonly initialObjective: InitialObjective;
  readonly openingReason: OpeningReason;
  readonly initialResponsible: InitialOperationalResponsibleRef;
  readonly createdAt: Date;
}

const CANON_REF = 'Entidade 01 — MISSÃO; DF-19; DF-20';

export class Mission extends AggregateRoot<MissionId> {
  private constructor(private readonly props: MissionProps) {
    super(props.id);
  }

  /**
   * Constrói uma Missão recém-nascida, garantindo os invariantes de nascimento.
   * Retorna CanonViolationError quando qualquer elemento obrigatório falta (DF-19).
   */
  static create(input: MissionBirthInput): Result<Mission, CanonViolationError> {
    // INV-17 — exatamente uma Pessoa (presença do beneficiário).
    if (input.beneficiary == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-17',
          canonReference: 'MISSÃO INV-17; DF-20',
          message: 'A missão exige exatamente uma Pessoa beneficiária.',
        }),
      );
    }
    // INV-06 — responsável operacional inicial identificado.
    if (input.initialResponsible == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-06',
          canonReference: 'MISSÃO INV-06; Art. 10º; DF-19',
          message: 'A missão exige responsável operacional inicial identificado.',
        }),
      );
    }
    // INV-18 — data de criação válida (elemento 6).
    if (!(input.createdAt instanceof Date) || Number.isNaN(input.createdAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-18',
          canonReference: CANON_REF,
          message: 'A missão exige data de criação válida (DF-19).',
        }),
      );
    }
    // INV-18 — objetivo e motivo presentes e não vazios (elementos 3 e 4).
    const objective = InitialObjective.create(input.initialObjectiveText);
    if (objective.isErr()) {
      return Result.err(objective.unwrapErr());
    }
    const reason = OpeningReason.create(input.openingReasonText);
    if (reason.isErr()) {
      return Result.err(reason.unwrapErr());
    }

    const mission = new Mission({
      id: input.id,
      beneficiary: input.beneficiary,
      initialObjective: objective.unwrap(),
      openingReason: reason.unwrap(),
      initialResponsible: input.initialResponsible,
      createdAt: new Date(input.createdAt.getTime()),
    });

    // Elemento 7 — histórico inicial: semeado pelo evento de nascimento.
    mission.addDomainEvent(new MissionCreated(input.id.toString(), mission.props.createdAt));
    return Result.ok(mission);
  }

  // Acessores imutáveis (INV-03: a missão não expõe "dono" pessoa/papel — pertence
  // ao Projeto; apenas referencia beneficiário e responsável).
  get beneficiary(): BeneficiaryPersonRef {
    return this.props.beneficiary;
  }
  get initialObjective(): InitialObjective {
    return this.props.initialObjective;
  }
  get openingReason(): OpeningReason {
    return this.props.openingReason;
  }
  get initialResponsible(): InitialOperationalResponsibleRef {
    return this.props.initialResponsible;
  }
  get createdAt(): Date {
    return new Date(this.props.createdAt.getTime());
  }
}
