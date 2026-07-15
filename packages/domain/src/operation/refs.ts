// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). A Operação conhece APENAS por
// identidade:
//   • a Missão em função da qual existe — OBRIGATÓRIA (item 11; INV-OP-01; DF-08);
//   • o responsável que a conduz — humano autorizado ou AHRI (itens 7/8/18;
//     Art. 10º/14º; auditabilidade — INV-OP-03).
//
// NÃO há referência à REGRA OPERACIONAL (12): entidade posterior; INV-OP-02
// ("rege-se integralmente pelo Volume 03") é uma NATUREZA/subordinação, não um
// ponteiro a uma RO específica — modelá-la anteciparia entidade futura. NÃO há
// referência a papéis (14–18)/AHRI(14) como entidades: o responsável é um ponteiro
// de identidade genérico. A Operação "não possui" Missão/Verdade/Pessoa (item 13)
// — só as referencia. Nenhum comportamento alheio é implementado.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Missão em função da qual a Operação existe (Canon: item 11; INV-OP-01; DF-08). */
export class OperationMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): OperationMissionRef {
    return new OperationMissionRef(id);
  }
  static fromString(id: string): OperationMissionRef {
    return new OperationMissionRef(toUuid(id));
  }
  equals(other?: OperationMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** Responsável que conduz a Operação — humano autorizado ou AHRI (Canon: itens 7/8/18; Art. 10º/14º; INV-OP-03). */
export class OperationResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): OperationResponsibleRef {
    return new OperationResponsibleRef(id);
  }
  static fromString(id: string): OperationResponsibleRef {
    return new OperationResponsibleRef(toUuid(id));
  }
  equals(other?: OperationResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}
