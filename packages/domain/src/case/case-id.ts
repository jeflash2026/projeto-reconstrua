// ─────────────────────────────────────────────────────────────────────────────
// CaseId — identidade do Caso. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 05 — CASO. O Caso é individualizado dentro de uma missão
// (item 6: "o caso os individualiza"); a identidade única é a base dessa
// individualização.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class CaseId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): CaseId {
    return new CaseId(value);
  }

  static fromString(value: string): CaseId {
    return new CaseId(toUuid(value));
  }
}
