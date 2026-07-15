// ─────────────────────────────────────────────────────────────────────────────
// AdvogadoId — identidade da designação de Advogado. Deriva do Kernel
// (Identity<Uuid>). Canon: Entidade 17 — ADVOGADO (papel humano titular da decisão
// jurídica definitiva e dos atos privativos da advocacia — DF-10; DF-09). A
// identidade individualiza a designação (Pessoa em papel, sobre uma Missão),
// temporária e rastreável (Art. 12º/14º).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class AdvogadoId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): AdvogadoId {
    return new AdvogadoId(value);
  }

  static fromString(value: string): AdvogadoId {
    return new AdvogadoId(toUuid(value));
  }
}
