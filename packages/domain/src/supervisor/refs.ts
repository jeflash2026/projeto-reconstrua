// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). O Supervisor conhece APENAS
// por identidade:
//   • a Pessoa que exerce o papel — OBRIGATÓRIA (item 2: "papel humano");
//   • a Missão sobre a qual supervisiona — OBRIGATÓRIA (item 18; INV-SU-02);
//   • a autoridade que o designou — Governança (item 7/8/11; DF-12).
//
// NÃO há referência aos papéis supervisionados (OPERADOR/PERITO/ADVOGADO/AHRI —
// 14–17): "supervisiona 14–17" (item 18) é ATUAÇÃO/interação, não dependência
// existencial (item 11 = autorização + critérios de supervisão). A supervisão
// concreta pertence à OPERAÇÃO (11)/R7 — omitida aqui (recomendação R1 do
// ROLE_ARCHITECTURE_AUDIT), o que elimina o maior fan-out de mutualidade nominal e
// mantém DAG. A Missão pertence ao Projeto (item 13); o Supervisor só a referencia.
// Nenhum comportamento alheio é implementado.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Pessoa (02) que exerce o papel de Supervisor (Canon: item 2). */
export class SupervisorPersonRef {
  private constructor(public readonly personId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): SupervisorPersonRef {
    return new SupervisorPersonRef(id);
  }
  static fromString(id: string): SupervisorPersonRef {
    return new SupervisorPersonRef(toUuid(id));
  }
  equals(other?: SupervisorPersonRef | null): boolean {
    return other != null && this.personId === other.personId;
  }
}

/** A Missão (01) sobre a qual o Supervisor supervisiona (Canon: item 18; INV-SU-02; R7). */
export class SupervisorMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): SupervisorMissionRef {
    return new SupervisorMissionRef(id);
  }
  static fromString(id: string): SupervisorMissionRef {
    return new SupervisorMissionRef(toUuid(id));
  }
  equals(other?: SupervisorMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** A autoridade que designou o Supervisor — Governança/responsável autorizado (Canon: item 7/8/11; DF-12). */
export class SupervisorAuthorityRef {
  private constructor(public readonly authorityId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): SupervisorAuthorityRef {
    return new SupervisorAuthorityRef(id);
  }
  static fromString(id: string): SupervisorAuthorityRef {
    return new SupervisorAuthorityRef(toUuid(id));
  }
  equals(other?: SupervisorAuthorityRef | null): boolean {
    return other != null && this.authorityId === other.authorityId;
  }
}
