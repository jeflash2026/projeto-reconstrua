// ─────────────────────────────────────────────────────────────────────────────
// SupervisorId — identidade da designação de Supervisor. Deriva do Kernel
// (Identity<Uuid>). Canon: Entidade 18 — SUPERVISOR (papel humano de supervisão da
// atuação sobre as missões — Art. 10º; R7). A identidade individualiza a designação
// (Pessoa em papel, sobre uma Missão), temporária e rastreável (Art. 12º/14º).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class SupervisorId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): SupervisorId {
    return new SupervisorId(value);
  }

  static fromString(value: string): SupervisorId {
    return new SupervisorId(toUuid(value));
  }
}
