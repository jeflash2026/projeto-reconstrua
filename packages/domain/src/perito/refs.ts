// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). O Perito conhece APENAS por
// identidade:
//   • a Pessoa que exerce o papel — OBRIGATÓRIA (item 1: "o profissional");
//   • a Missão sobre a qual atua — OBRIGATÓRIA (item 18; INV-PT-03);
//   • a fase PERÍCIA (13) em que atua — OBRIGATÓRIA (item 11 "do que depende";
//     item 18 "atua na etapa PERÍCIA");
//   • a autoridade que o designou — Governança (item 7; DF-12).
//
// A `PeritoExpertiseRef` aponta a PERÍCIA (13) por identidade — o Perito ATUA na
// etapa, mas NÃO É a etapa (INV-PT-02; DF-17). A referência mútua PERÍCIA↔PERITO é
// BIJEÇÃO-RELAÇÃO (o perito conduz a etapa; a etapa é onde o perito atua), NÃO
// dependência circular — ponteiros `Uuid` nominais, zero import (precedente
// Estado↔Etapa). NÃO há referência ao ADVOGADO (papel distinto). A Missão pertence
// ao Projeto (item 13); o Perito só a referencia. Nenhum comportamento alheio.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Pessoa (02) que exerce o papel de Perito (Canon: item 1). */
export class PeritoPersonRef {
  private constructor(public readonly personId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): PeritoPersonRef {
    return new PeritoPersonRef(id);
  }
  static fromString(id: string): PeritoPersonRef {
    return new PeritoPersonRef(toUuid(id));
  }
  equals(other?: PeritoPersonRef | null): boolean {
    return other != null && this.personId === other.personId;
  }
}

/** A Missão (01) sobre a qual o Perito atua (Canon: item 18; INV-PT-03; R7). */
export class PeritoMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): PeritoMissionRef {
    return new PeritoMissionRef(id);
  }
  static fromString(id: string): PeritoMissionRef {
    return new PeritoMissionRef(toUuid(id));
  }
  equals(other?: PeritoMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** A fase PERÍCIA (13) em que o Perito atua (Canon: item 11/18) — o Perito atua na etapa, não É a etapa (INV-PT-02). */
export class PeritoExpertiseRef {
  private constructor(public readonly periciaId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): PeritoExpertiseRef {
    return new PeritoExpertiseRef(id);
  }
  static fromString(id: string): PeritoExpertiseRef {
    return new PeritoExpertiseRef(toUuid(id));
  }
  equals(other?: PeritoExpertiseRef | null): boolean {
    return other != null && this.periciaId === other.periciaId;
  }
}

/** A autoridade que designou o Perito — Governança/responsável autorizado (Canon: item 7/8; DF-12). */
export class PeritoAuthorityRef {
  private constructor(public readonly authorityId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): PeritoAuthorityRef {
    return new PeritoAuthorityRef(id);
  }
  static fromString(id: string): PeritoAuthorityRef {
    return new PeritoAuthorityRef(toUuid(id));
  }
  equals(other?: PeritoAuthorityRef | null): boolean {
    return other != null && this.authorityId === other.authorityId;
  }
}
