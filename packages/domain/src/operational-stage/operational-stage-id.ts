// ─────────────────────────────────────────────────────────────────────────────
// OperationalStageId — identidade da Etapa Operacional. Deriva do Kernel
// (Identity<Uuid>). Canon: Entidade 09 — ETAPA OPERACIONAL ("Etapa" e "Estágio"
// são sinônimos oficiais — DF-08). A identidade individualiza cada representação.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class OperationalStageId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): OperationalStageId {
    return new OperationalStageId(value);
  }

  static fromString(value: string): OperationalStageId {
    return new OperationalStageId(toUuid(value));
  }
}
