// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). O Advogado conhece APENAS por
// identidade:
//   • a Pessoa que exerce o papel — OBRIGATÓRIA (item 1: "o profissional");
//   • a Missão sobre a qual atua — OBRIGATÓRIA (item 11/18; INV-AD-03);
//   • a autoridade que o designou — Governança (item 7/8; DF-12).
//
// NÃO há referência a PROCESSO(06) nem CASO(05): "conduz Processos; decide sobre
// Casos" (item 18) é ATUAÇÃO (o quê o Advogado faz sobre eles), não dependência
// existencial (item 11 = autorização + missão). A atuação pertence à OPERAÇÃO
// (11)/R7 — omitida aqui (recomendação R1 do ROLE_ARCHITECTURE_AUDIT), o que evita
// lógica operacional na entidade e mantém DAG. A Missão pertence ao Projeto
// (item 13); o Advogado só a referencia. Nenhum comportamento alheio.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Pessoa (02) que exerce o papel de Advogado (Canon: item 1). */
export class AdvogadoPersonRef {
  private constructor(public readonly personId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): AdvogadoPersonRef {
    return new AdvogadoPersonRef(id);
  }
  static fromString(id: string): AdvogadoPersonRef {
    return new AdvogadoPersonRef(toUuid(id));
  }
  equals(other?: AdvogadoPersonRef | null): boolean {
    return other != null && this.personId === other.personId;
  }
}

/** A Missão (01) sobre a qual o Advogado atua (Canon: item 11/18; INV-AD-03; R7). */
export class AdvogadoMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): AdvogadoMissionRef {
    return new AdvogadoMissionRef(id);
  }
  static fromString(id: string): AdvogadoMissionRef {
    return new AdvogadoMissionRef(toUuid(id));
  }
  equals(other?: AdvogadoMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** A autoridade que designou o Advogado — Governança/responsável autorizado (Canon: item 7/8; DF-12). */
export class AdvogadoAuthorityRef {
  private constructor(public readonly authorityId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): AdvogadoAuthorityRef {
    return new AdvogadoAuthorityRef(id);
  }
  static fromString(id: string): AdvogadoAuthorityRef {
    return new AdvogadoAuthorityRef(toUuid(id));
  }
  equals(other?: AdvogadoAuthorityRef | null): boolean {
    return other != null && this.authorityId === other.authorityId;
  }
}
