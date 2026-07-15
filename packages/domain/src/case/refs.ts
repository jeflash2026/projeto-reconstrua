// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). O Caso conhece APENAS por
// identidade:
//   • a Missão a que pertence (INV-CA-01; item 11 "depende de uma Missão"), e
//   • o responsável autorizado que o reconhece/enquadra (item 7/8; DF-12; Art. 14º).
//
// NÃO há aqui referência a PROCESSO (Entidade 06, posterior — "tudo que pertence a
// Processo permanece fora desta entidade"), nem a Pessoa/Verdade/Estado
// (item 13 "nunca poderá possuir"). Nenhum comportamento alheio é implementado.
// Nomes com prefixo "Case" para não colidir no índice do domínio com as
// referências homônimas de DOCUMENTO/EVENTO.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A única Missão à qual o Caso pertence (Canon: Entidade 05, item 11; INV-CA-01; DF-08). */
export class CaseMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): CaseMissionRef {
    return new CaseMissionRef(id);
  }
  static fromString(id: string): CaseMissionRef {
    return new CaseMissionRef(toUuid(id));
  }
  equals(other?: CaseMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** Responsável autorizado pelo reconhecimento/enquadramento do Caso (Canon: Entidade 05, itens 7/8; DF-12; Art. 14º). */
export class CaseResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): CaseResponsibleRef {
    return new CaseResponsibleRef(id);
  }
  static fromString(id: string): CaseResponsibleRef {
    return new CaseResponsibleRef(toUuid(id));
  }
  equals(other?: CaseResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}
