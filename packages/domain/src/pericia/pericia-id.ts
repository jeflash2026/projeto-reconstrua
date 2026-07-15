// ─────────────────────────────────────────────────────────────────────────────
// PericiaId — identidade da Perícia. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 13 — PERÍCIA (etapa operacional especializada — DF-17). A
// identidade individualiza a fase pericial; a Perícia (etapa) é distinta do
// Perito (papel — Entidade 16): INV-PE-01/02.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class PericiaId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): PericiaId {
    return new PericiaId(value);
  }

  static fromString(value: string): PericiaId {
    return new PericiaId(toUuid(value));
  }
}
