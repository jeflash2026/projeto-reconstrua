// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). A Regra Operacional conhece
// APENAS por identidade:
//   • o responsável pela APROVAÇÃO da regra — humano indicado (DF-13, elemento 9;
//     item 7; Art. 14º).
//
// NÃO há referência a AHRI(14)/OPERAÇÃO(11)/EVENTO(04) como entidades: item 22 as
// cita nominalmente, mas os eventos de entrada/saída são DESCRITORES DE TIPO em
// texto (parte da especificação da norma), não ponteiros a instâncias; a AHRI e a
// Operação são posteriores/geridas por outra camada. O "responsável pela aprovação"
// é humano (DF-13), NÃO a AHRI — ponteiro de identidade genérico, sem antecipar a
// Entidade 14. Nenhum comportamento alheio é implementado.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** Responsável humano pela aprovação da Regra (Canon: DF-13, elemento 9; item 7; Art. 14º). */
export class ApprovalResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): ApprovalResponsibleRef {
    return new ApprovalResponsibleRef(id);
  }
  static fromString(id: string): ApprovalResponsibleRef {
    return new ApprovalResponsibleRef(toUuid(id));
  }
  equals(other?: ApprovalResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}
