// ─────────────────────────────────────────────────────────────────────────────
// ProjectionId — identidade da Projeção. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 10 — PROJEÇÃO. Cada leitura derivada é individualizada; a
// identidade é a base dessa individualização (ainda que a Projeção seja
// descartável/recalculável — item 9).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class ProjectionId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): ProjectionId {
    return new ProjectionId(value);
  }

  static fromString(value: string): ProjectionId {
    return new ProjectionId(toUuid(value));
  }
}
