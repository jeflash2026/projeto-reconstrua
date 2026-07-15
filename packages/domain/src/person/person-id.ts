// ─────────────────────────────────────────────────────────────────────────────
// PersonId — identidade da Pessoa. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 02 — PESSOA, elemento de reconhecimento 1 ("Identificador único",
// DF-23); base de INV-P02 (jamais duplicada) e de INV-P01 (identidade permanente).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class PersonId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): PersonId {
    return new PersonId(value);
  }

  static fromString(value: string): PersonId {
    return new PersonId(toUuid(value));
  }
}
