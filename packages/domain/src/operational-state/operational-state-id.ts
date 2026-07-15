// ─────────────────────────────────────────────────────────────────────────────
// OperationalStateId — identidade do Estado Operacional. Deriva do Kernel
// (Identity<Uuid>). Canon: Entidade 08 — ESTADO OPERACIONAL. Cada estado derivado
// é individualizado no histórico; a identidade é a base dessa individualização.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class OperationalStateId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): OperationalStateId {
    return new OperationalStateId(value);
  }

  static fromString(value: string): OperationalStateId {
    return new OperationalStateId(toUuid(value));
  }
}
