// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). A Etapa Operacional conhece
// APENAS por identidade:
//   • o Estado Operacional (08) que REPRESENTA — OBRIGATÓRIO e ÚNICO (item 11,
//     "do Estado, 1:1"; INV-ET-01; DF-08).
//
// NÃO há referência direta à MISSÃO: o item 22 lista apenas ESTADO(08) e PERÍCIA(13);
// a ligação por missão é TRANSITIVA através do Estado (que pertence a uma missão) —
// INV-ET-03 decorre de INV-EO-01 via a bijeção 1:1. NÃO há referência a PERÍCIA(13):
// entidade posterior; a Lei da Definição Local proíbe defini-la aqui. Nenhum
// comportamento do Estado é implementado — só um ponteiro de identidade.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** O Estado Operacional (08) que esta Etapa representa — exatamente um (Canon: item 11; INV-ET-01; 1:1). */
export class RepresentedStateRef {
  private constructor(public readonly stateId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): RepresentedStateRef {
    return new RepresentedStateRef(id);
  }
  static fromString(id: string): RepresentedStateRef {
    return new RepresentedStateRef(toUuid(id));
  }
  equals(other?: RepresentedStateRef | null): boolean {
    return other != null && this.stateId === other.stateId;
  }
}
