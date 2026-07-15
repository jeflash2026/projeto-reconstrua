// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). O Cliente conhece APENAS por
// identidade:
//   • a Pessoa (02) de quem é condição — OBRIGATÓRIA e EXCLUSIVA (item 11: "de uma
//     Pessoa reconhecida"; INV-CL-01);
//   • o responsável autorizado pelo reconhecimento da condição (item 7/8; DF-12;
//     Art. 14º).
//
// NÃO há referência à MISSÃO (01): "relaciona-se a MISSÕES da pessoa" (item 18) é
// TRANSITIVO via a Pessoa (que possui as missões); item 11 fixa dependência só da
// Pessoa. NÃO há referência a papéis (o Cliente é condição, não ator). O Cliente
// JAMAIS possui a Pessoa (item 12) — só a referencia; a condição não altera a
// identidade civil (INV-CL-03). Nenhum comportamento alheio é implementado.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Pessoa (02) de quem o Cliente é condição — reconhecida (Canon: item 11; INV-CL-01; DF-23). */
export class ClientePersonRef {
  private constructor(public readonly personId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): ClientePersonRef {
    return new ClientePersonRef(id);
  }
  static fromString(id: string): ClientePersonRef {
    return new ClientePersonRef(toUuid(id));
  }
  equals(other?: ClientePersonRef | null): boolean {
    return other != null && this.personId === other.personId;
  }
}

/** O responsável autorizado pelo reconhecimento da condição de Cliente (Canon: item 7/8; DF-12; Art. 14º). */
export class ClienteRecognitionResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): ClienteRecognitionResponsibleRef {
    return new ClienteRecognitionResponsibleRef(id);
  }
  static fromString(id: string): ClienteRecognitionResponsibleRef {
    return new ClienteRecognitionResponsibleRef(toUuid(id));
  }
  equals(other?: ClienteRecognitionResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}
