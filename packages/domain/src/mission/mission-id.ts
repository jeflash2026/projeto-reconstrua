// ─────────────────────────────────────────────────────────────────────────────
// MissionId — identidade da Missão. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 01 — MISSÃO, elemento de nascimento 1 ("Identificador único",
// DF-19); INV-05 (jamais duplicada — a unicidade da identidade é a base disso).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class MissionId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): MissionId {
    return new MissionId(value);
  }

  static fromString(value: string): MissionId {
    return new MissionId(toUuid(value));
  }
}
