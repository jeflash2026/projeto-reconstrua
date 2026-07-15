// ─────────────────────────────────────────────────────────────────────────────
// OperadorId — identidade da designação de Operador. Deriva do Kernel
// (Identity<Uuid>). Canon: Entidade 15 — OPERADOR (papel humano de condução
// operacional diária — DF-10). A identidade individualiza a designação (Pessoa em
// papel, sobre uma Missão), temporária e rastreável (Art. 12º/14º).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class OperadorId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): OperadorId {
    return new OperadorId(value);
  }

  static fromString(value: string): OperadorId {
    return new OperadorId(toUuid(value));
  }
}
