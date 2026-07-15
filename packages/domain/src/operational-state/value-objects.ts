// ─────────────────────────────────────────────────────────────────────────────
// Value Objects estritamente necessários ao Estado Operacional.
// Canon: Entidade 08 — ESTADO OPERACIONAL. Propriedades (item 14): unicidade;
// derivação da Verdade; TERMINALIDADE quando encerrado.
//
// TerminalState modela a terminalidade: o Canon fixa EXATAMENTE DOIS estados
// terminais oficiais — CONCLUÍDA e ENCERRADA (Entidade 08 — Estados Terminais;
// DF-11). "Não há terceiro estado terminal." Os estados NÃO terminais (nascida,
// em evolução, bloqueada) são DADOS OPERACIONAIS, NÃO Canon (linha do Canon) —
// por isso NÃO são enumerados aqui; a ausência de terminalidade os representa.
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 08 — ESTADO OPERACIONAL; Estados Terminais Oficiais; DF-11';
const TERMINAL_ID = 'EO-ESTADO-TERMINAL';

/** Estados terminais oficiais — conjunto FECHADO de exatamente dois (DF-11). */
export type TerminalStateValue = 'CONCLUIDA' | 'ENCERRADA';

const TERMINAL_VALUES: ReadonlyArray<TerminalStateValue> = ['CONCLUIDA', 'ENCERRADA'];

/**
 * Estado terminal (Canon: Entidade 08 — Estados Terminais; DF-11). Conjunto
 * exaustivo: CONCLUÍDA (objetivo legítimo cumprido) ou ENCERRADA (encerramento
 * legítimo por motivo registrado). Não há terceiro. Usado SOMENTE quando o Estado
 * é terminal; ausência = estado em curso (não Canon).
 */
export class TerminalState extends ValueObject<{ value: TerminalStateValue }> {
  private constructor(value: TerminalStateValue) {
    super({ value });
  }
  get value(): TerminalStateValue {
    return this.props.value;
  }
  isConcluded(): boolean {
    return this.props.value === 'CONCLUIDA';
  }
  isClosed(): boolean {
    return this.props.value === 'ENCERRADA';
  }
  static concluded(): TerminalState {
    return new TerminalState('CONCLUIDA');
  }
  static closed(): TerminalState {
    return new TerminalState('ENCERRADA');
  }
  static create(value: TerminalStateValue): Result<TerminalState, CanonViolationError> {
    if (!TERMINAL_VALUES.includes(value)) {
      return Result.err(
        new CanonViolationError({
          invariantId: TERMINAL_ID,
          canonReference: CANON_REF,
          message: 'Estado terminal inválido: só existem CONCLUÍDA e ENCERRADA (DF-11).',
        }),
      );
    }
    return Result.ok(new TerminalState(value));
  }
}
