// ─────────────────────────────────────────────────────────────────────────────
// ProcessId — identidade do Processo. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 06 — PROCESSO. O Processo é um instrumento jurídico
// individualizado dentro de uma missão (DF-10); a identidade única é a base dessa
// individualização.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class ProcessId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): ProcessId {
    return new ProcessId(value);
  }

  static fromString(value: string): ProcessId {
    return new ProcessId(toUuid(value));
  }
}
