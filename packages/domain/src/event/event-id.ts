// ─────────────────────────────────────────────────────────────────────────────
// EventId — identidade do Evento. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 04 — EVENTO. Cada reconhecimento de evento é independente
// (INV-E12-05) e tem identidade própria.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class EventId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): EventId {
    return new EventId(value);
  }

  static fromString(value: string): EventId {
    return new EventId(toUuid(value));
  }
}
