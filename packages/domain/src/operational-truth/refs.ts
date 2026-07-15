// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). A Verdade Operacional conhece
// APENAS por identidade:
//   • a Missão para a qual é calculada — OBRIGATÓRIA (Lei 2; item 1; INV-VO-01);
//   • o responsável pela síntese — humano autorizado ou AHRI via Regra Operacional
//     (item 7; INV-E8-06; DF-09; DF-12; DF-13; Art. 14º).
//
// NÃO há referência a ESTADO (08) nem ETAPA (09) — entidades posteriores para as
// quais a Verdade "aponta" (item 12), não modeladas aqui (não antecipar). NÃO há
// referência ao Evento veicular (a causação Evento→síntese pertence a R5 / Event
// Store — E8-L08). Nenhum comportamento alheio é implementado; só ponteiros de
// identidade. Nomes com prefixo para não colidir no índice do domínio.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Missão para a qual esta Verdade Operacional é calculada (Canon: Entidade 07, item 1; Lei 2; INV-VO-01). */
export class OperationalTruthMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): OperationalTruthMissionRef {
    return new OperationalTruthMissionRef(id);
  }
  static fromString(id: string): OperationalTruthMissionRef {
    return new OperationalTruthMissionRef(toUuid(id));
  }
  equals(other?: OperationalTruthMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** Responsável pela síntese — humano autorizado ou AHRI via RO (Canon: item 7; INV-E8-06; DF-09; DF-12; DF-13; Art. 14º). */
export class SynthesisResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): SynthesisResponsibleRef {
    return new SynthesisResponsibleRef(id);
  }
  static fromString(id: string): SynthesisResponsibleRef {
    return new SynthesisResponsibleRef(toUuid(id));
  }
  equals(other?: SynthesisResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}
