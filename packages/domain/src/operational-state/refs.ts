// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). O Estado Operacional conhece
// APENAS por identidade:
//   • a Missão a que pertence — OBRIGATÓRIA (item 22; Lei 2; INV-EO-01);
//   • a Verdade Operacional (07) da qual DERIVA — OBRIGATÓRIA e EXCLUSIVA
//     (item 11; INV-EO-02; INV-02; DF-08).
//
// NÃO há referência à ETAPA (09): a Etapa REPRESENTA o Estado (Etapa→Estado), não
// o contrário; e é entidade posterior (não antecipar). Nenhum comportamento de
// MISSÃO ou VERDADE é implementado aqui — só ponteiros de identidade. Nomes com
// prefixo para não colidir no índice do domínio.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Missão a que o Estado pertence (Canon: Entidade 08, item 22; Lei 2; INV-EO-01). */
export class OperationalStateMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): OperationalStateMissionRef {
    return new OperationalStateMissionRef(id);
  }
  static fromString(id: string): OperationalStateMissionRef {
    return new OperationalStateMissionRef(toUuid(id));
  }
  equals(other?: OperationalStateMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** A Verdade Operacional (07) da qual o Estado deriva — fonte exclusiva (Canon: item 11; INV-EO-02; DF-08). */
export class DerivedFromTruthRef {
  private constructor(public readonly truthId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): DerivedFromTruthRef {
    return new DerivedFromTruthRef(id);
  }
  static fromString(id: string): DerivedFromTruthRef {
    return new DerivedFromTruthRef(toUuid(id));
  }
  equals(other?: DerivedFromTruthRef | null): boolean {
    return other != null && this.truthId === other.truthId;
  }
}
