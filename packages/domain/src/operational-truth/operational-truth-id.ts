// ─────────────────────────────────────────────────────────────────────────────
// OperationalTruthId — identidade da Verdade Operacional. Deriva do Kernel
// (Identity<Uuid>). Canon: Entidade 07 — VERDADE OPERACIONAL. Cada síntese é
// única e datada (E8-L03); a identidade individualiza cada Verdade no histórico
// perpétuo (INV-E8-03).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class OperationalTruthId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): OperationalTruthId {
    return new OperationalTruthId(value);
  }

  static fromString(value: string): OperationalTruthId {
    return new OperationalTruthId(toUuid(value));
  }
}
