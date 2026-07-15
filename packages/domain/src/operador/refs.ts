// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). O Operador conhece APENAS por
// identidade:
//   • a Pessoa que exerce o papel — OBRIGATÓRIA (item 1: "a pessoa responsável");
//   • a Missão sobre a qual atua — OBRIGATÓRIA (item 11/18; INV-OPr-01);
//   • a autoridade que o designou — Governança/responsável autorizado (item 7/8/11;
//     DF-12).
//
// NÃO há referência a AHRI(14)/ADVOGADO(17)/PERITO(16): o "acionar a competência
// certa" é relação de INTERAÇÃO, pertencente à OPERAÇÃO (11)/R7 — omitida aqui
// (recomendação R1 do ROLE_ARCHITECTURE_AUDIT), o que elimina a mutualidade nominal
// e mantém DAG. A Missão pertence ao Projeto (item 13); o Operador só a referencia.
// Nenhum comportamento alheio é implementado.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Pessoa (02) que exerce o papel de Operador (Canon: item 1). */
export class OperadorPersonRef {
  private constructor(public readonly personId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): OperadorPersonRef {
    return new OperadorPersonRef(id);
  }
  static fromString(id: string): OperadorPersonRef {
    return new OperadorPersonRef(toUuid(id));
  }
  equals(other?: OperadorPersonRef | null): boolean {
    return other != null && this.personId === other.personId;
  }
}

/** A Missão (01) sobre a qual o Operador atua (Canon: item 11/18; INV-OPr-01; R7). */
export class OperadorMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): OperadorMissionRef {
    return new OperadorMissionRef(id);
  }
  static fromString(id: string): OperadorMissionRef {
    return new OperadorMissionRef(toUuid(id));
  }
  equals(other?: OperadorMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** A autoridade que designou o Operador — Governança/responsável autorizado (Canon: item 7/8/11; DF-12). */
export class OperadorAuthorityRef {
  private constructor(public readonly authorityId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): OperadorAuthorityRef {
    return new OperadorAuthorityRef(id);
  }
  static fromString(id: string): OperadorAuthorityRef {
    return new OperadorAuthorityRef(toUuid(id));
  }
  equals(other?: OperadorAuthorityRef | null): boolean {
    return other != null && this.authorityId === other.authorityId;
  }
}
