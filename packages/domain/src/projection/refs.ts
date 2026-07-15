// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). A Projeção conhece APENAS por
// identidade:
//   • a Verdade Operacional (07) da qual DERIVA — OBRIGATÓRIA e EXCLUSIVA
//     (item 11: "exclusivamente da Verdade"; INV-PJ-01; DF-03).
//
// NÃO há referência direta à MISSÃO: item 11 fixa dependência EXCLUSIVA da Verdade;
// a missão é TRANSITIVA através da Verdade (que é por missão) — mesmo tratamento da
// Etapa. NÃO há referência a Estado(08) nem Etapa(09): a Projeção "não possui"
// nenhum deles (item 13) e jamais os altera. Nenhum comportamento da Verdade é
// implementado — só um ponteiro de identidade. Nome distinto de `DerivedFromTruthRef`
// (Estado 08) para não colidir no índice do domínio nem acoplar entidades.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Verdade Operacional (07) da qual a Projeção deriva — fonte exclusiva (Canon: item 11; INV-PJ-01; DF-03). */
export class ProjectionTruthRef {
  private constructor(public readonly truthId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): ProjectionTruthRef {
    return new ProjectionTruthRef(id);
  }
  static fromString(id: string): ProjectionTruthRef {
    return new ProjectionTruthRef(toUuid(id));
  }
  equals(other?: ProjectionTruthRef | null): boolean {
    return other != null && this.truthId === other.truthId;
  }
}
