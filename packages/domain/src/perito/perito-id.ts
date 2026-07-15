// ─────────────────────────────────────────────────────────────────────────────
// PeritoId — identidade da designação de Perito. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 16 — PERITO (papel humano titular dos atos privativos de perícia
// — DF-10; DF-09). A identidade individualiza a designação (Pessoa em papel, numa
// fase pericial de uma Missão), temporária e rastreável (Art. 12º/14º).
// O Perito (papel) é DISTINTO da PERÍCIA (etapa — 13): INV-PT-02; DF-17.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class PeritoId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): PeritoId {
    return new PeritoId(value);
  }

  static fromString(value: string): PeritoId {
    return new PeritoId(toUuid(value));
  }
}
