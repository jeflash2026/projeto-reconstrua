// ─────────────────────────────────────────────────────────────────────────────
// OperationId — identidade da Operação. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 11 — OPERAÇÃO. A identidade individualiza o agir organizado
// conduzido em função de uma missão; base da auditabilidade (INV-OP-03; R9).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class OperationId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): OperationId {
    return new OperationId(value);
  }

  static fromString(value: string): OperationId {
    return new OperationId(toUuid(value));
  }
}
