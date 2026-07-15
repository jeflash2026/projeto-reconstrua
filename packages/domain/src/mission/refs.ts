// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS (Canon DF-18: "menção nominal permitida; dependência
// semântica de definição futura vedada"). A Missão referencia a Pessoa
// beneficiária e o responsável operacional inicial POR IDENTIDADE, sem implementar
// essas entidades (que têm sprints próprias). Não há aqui nenhum comportamento de
// Pessoa nem de Papel — apenas um ponteiro tipado.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** Referência à Pessoa beneficiária (Canon: elemento de nascimento 2, DF-19; INV-17). */
export class BeneficiaryPersonRef {
  private constructor(public readonly personId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): BeneficiaryPersonRef {
    return new BeneficiaryPersonRef(id);
  }
  static fromString(id: string): BeneficiaryPersonRef {
    return new BeneficiaryPersonRef(toUuid(id));
  }
  equals(other?: BeneficiaryPersonRef | null): boolean {
    return other != null && this.personId === other.personId;
  }
}

/** Referência ao responsável operacional inicial (Canon: elemento 5, DF-19; INV-06; Art. 10º). */
export class InitialOperationalResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): InitialOperationalResponsibleRef {
    return new InitialOperationalResponsibleRef(id);
  }
  static fromString(id: string): InitialOperationalResponsibleRef {
    return new InitialOperationalResponsibleRef(toUuid(id));
  }
  equals(other?: InitialOperationalResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}
