// ─────────────────────────────────────────────────────────────────────────────
// OperationalStateAggregate — agregado da Entidade 08 (ESTADO OPERACIONAL).
// Deriva EXCLUSIVAMENTE do Livro Mestre (Entidade 08; DF-05; DF-08; DF-11; Lei 1;
// Lei 2; INV-01; INV-02; INV-EO-01..04).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA um Estado DERIVADO da Verdade Operacional vigente — fábrica
//     `derive`, emite OperationalStateDerived (item 7: "deriva automaticamente da
//     Verdade");
//   • aponta a Verdade (07) da qual deriva, como fonte ÚNICA e obrigatória
//     (INV-EO-02; INV-02; DF-08);
//   • vincula o Estado a exatamente uma Missão (INV-EO-01; Lei 2);
//   • registra a terminalidade quando existir — CONCLUÍDA/ENCERRADA (DF-11);
//   • é datado (unicidade por missão por instante).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO é fonte autônoma de estado (item 16) — só deriva da Verdade;
//   • NÃO se recalcula, NÃO se altera por interface (INV-EO-04; DF-08; DF-03) —
//     construtor privado + sem mutadores;
//   • NÃO executa R5 nem R6 — a evolução (mudança por Evento Relevante) é do
//     caso de uso; aqui só se materializa o resultado da derivação;
//   • NÃO é a Verdade (dela deriva) nem a Etapa (representação visual — 09,
//     posterior; não referenciada — Etapa→Estado, não o contrário);
//   • NÃO enumera estados não terminais (dados operacionais, não Canon);
//   • NÃO decide.
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { OperationalStateId } from './operational-state-id.js';
import type { OperationalStateMissionRef, DerivedFromTruthRef } from './refs.js';
import { TerminalState } from './value-objects.js';
import type { TerminalStateValue } from './value-objects.js';
import { OperationalStateDerived } from './operational-state-events.js';

/** Entrada de derivação do Estado (Entidade 08; itens 1/7/11/14). */
export interface OperationalStateDerivationInput {
  readonly id: OperationalStateId;
  readonly mission: OperationalStateMissionRef; // exatamente uma (INV-EO-01; Lei 2)
  readonly derivedFromTruth: DerivedFromTruthRef; // fonte exclusiva (INV-EO-02; DF-08)
  readonly terminalState?: TerminalStateValue; // OPCIONAL — terminalidade (DF-11)
  readonly derivedAt: Date; // datação (unicidade por instante)
}

interface OperationalStateProps {
  readonly id: OperationalStateId;
  readonly mission: OperationalStateMissionRef;
  readonly derivedFromTruth: DerivedFromTruthRef;
  readonly terminalState: TerminalState | null;
  readonly derivedAt: Date;
}

const DERIVE_ID = 'INV-EO-02';
const DERIVE_REF = 'Entidade 08; INV-EO-02; INV-02; DF-08';
const MISSION_ID = 'EO-POR-MISSAO';
const MISSION_REF = 'Entidade 08, item 22; Lei 2; INV-EO-01';
const DATE_ID = 'EO-DATADO';
const DATE_REF = 'Entidade 08, item 14 (unicidade por instante); Art. 14º';

export class OperationalStateAggregate extends AggregateRoot<OperationalStateId> {
  private constructor(private readonly props: OperationalStateProps) {
    super(props.id);
  }

  /**
   * Materializa um Estado derivado da Verdade vigente (item 7: deriva
   * automaticamente da Verdade). NÃO executa R5/R6: assembla o snapshot imutável
   * e valida sua boa-formação (derivação, missão, datação, terminalidade).
   */
  static derive(
    input: OperationalStateDerivationInput,
  ): Result<OperationalStateAggregate, CanonViolationError> {
    // INV-EO-02 — deriva exclusivamente da Verdade Operacional (fonte obrigatória).
    if (input.derivedFromTruth == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: DERIVE_ID,
          canonReference: DERIVE_REF,
          message: 'O Estado deriva exclusivamente da Verdade Operacional; a Verdade de origem é obrigatória (INV-EO-02).',
        }),
      );
    }
    // INV-EO-01 (parcial) — pertence a exatamente uma Missão.
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: MISSION_ID,
          canonReference: MISSION_REF,
          message: 'O Estado pertence a exatamente uma Missão; a Missão é obrigatória (Lei 2).',
        }),
      );
    }
    // Datação — unicidade por instante (Art. 14º).
    if (!(input.derivedAt instanceof Date) || Number.isNaN(input.derivedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: DATE_ID,
          canonReference: DATE_REF,
          message: 'O Estado deriva sem datação válida (unicidade por instante).',
        }),
      );
    }
    // Terminalidade — OPCIONAL; quando presente, do conjunto fechado (DF-11).
    let terminalState: TerminalState | null = null;
    if (input.terminalState !== undefined) {
      const parsed = TerminalState.create(input.terminalState);
      if (parsed.isErr()) {
        return Result.err(parsed.unwrapErr());
      }
      terminalState = parsed.unwrap();
    }

    const state = new OperationalStateAggregate({
      id: input.id,
      mission: input.mission,
      derivedFromTruth: input.derivedFromTruth,
      terminalState,
      derivedAt: new Date(input.derivedAt.getTime()),
    });

    state.addDomainEvent(new OperationalStateDerived(input.id.toString(), state.props.derivedAt));
    return Result.ok(state);
  }

  // Acessores imutáveis. Nenhuma fonte autônoma, recálculo, alteração por interface,
  // representação visual (Etapa) ou decisão (INV-EO-02/04; item 16).
  get mission(): OperationalStateMissionRef {
    return this.props.mission;
  }
  get derivedFromTruth(): DerivedFromTruthRef {
    return this.props.derivedFromTruth;
  }
  /** Estado terminal quando existir; null = estado em curso (não Canon) (DF-11). */
  get terminalState(): TerminalState | null {
    return this.props.terminalState;
  }
  /** Conveniência de leitura: o Estado atingiu terminalidade legítima (DF-11). */
  get isTerminal(): boolean {
    return this.props.terminalState !== null;
  }
  get derivedAt(): Date {
    return new Date(this.props.derivedAt.getTime());
  }
}
