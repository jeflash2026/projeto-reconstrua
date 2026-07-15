// ─────────────────────────────────────────────────────────────────────────────
// AhriId — identidade da AHRI. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 14 — AHRI (inteligência operacional cognitiva assistiva —
// Art. 15º; DF-09). A identidade individualiza cada assunção de responsabilidade
// operacional registrada; as atuações são perpétuas e auditáveis (Lei 3/4).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class AhriId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): AhriId {
    return new AhriId(value);
  }

  static fromString(value: string): AhriId {
    return new AhriId(toUuid(value));
  }
}
