// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). A Perícia conhece APENAS por
// identidade:
//   • a Missão a que a etapa pertence — OBRIGATÓRIA (item 11/22; INV-PE-03; Lei 2);
//   • a Etapa Operacional (09) que ela ESPECIALIZA — OBRIGATÓRIA (item 3/11/22;
//     "espécie de Etapa"; DF-17);
//   • o Perito responsável que a conduz tecnicamente — nominal (itens 18/19; DF-10).
//
// A `PericiaPeritoRef` é a IDENTIDADE do perito responsável, NÃO a entidade PERITO
// (16, posterior): a Perícia é etapa, o Perito é papel — distintos (INV-PE-01/02;
// item 13 "não confundir-se com o Perito"). Referenciar QUEM conduz não confunde a
// etapa com a pessoa. NÃO há referência direta ao ESTADO(08): transitiva via a
// Etapa (item 22 lista ETAPA). Nenhum comportamento alheio é implementado.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Missão a que a etapa pericial pertence (Canon: item 11/22; INV-PE-03; Lei 2). */
export class PericiaMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): PericiaMissionRef {
    return new PericiaMissionRef(id);
  }
  static fromString(id: string): PericiaMissionRef {
    return new PericiaMissionRef(toUuid(id));
  }
  equals(other?: PericiaMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** A Etapa Operacional (09) que a Perícia especializa (Canon: item 3/11/22; DF-17). */
export class SpecializedStageRef {
  private constructor(public readonly stageId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): SpecializedStageRef {
    return new SpecializedStageRef(id);
  }
  static fromString(id: string): SpecializedStageRef {
    return new SpecializedStageRef(toUuid(id));
  }
  equals(other?: SpecializedStageRef | null): boolean {
    return other != null && this.stageId === other.stageId;
  }
}

/** Identidade do Perito responsável pela condução técnica (Canon: itens 18/19; DF-10) — NÃO a entidade PERITO(16). */
export class PericiaPeritoRef {
  private constructor(public readonly peritoId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): PericiaPeritoRef {
    return new PericiaPeritoRef(id);
  }
  static fromString(id: string): PericiaPeritoRef {
    return new PericiaPeritoRef(toUuid(id));
  }
  equals(other?: PericiaPeritoRef | null): boolean {
    return other != null && this.peritoId === other.peritoId;
  }
}
