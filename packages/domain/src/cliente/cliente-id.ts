// ─────────────────────────────────────────────────────────────────────────────
// ClienteId — identidade da condição de Cliente. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 19 — CLIENTE (condição contratual/comercial que uma Pessoa assume
// — entidade DISTINTA de PESSOA, item 1). A identidade individualiza a CONDIÇÃO,
// jamais a Pessoa (INV-CL-02/03): a Pessoa (02) tem sua própria identidade.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class ClienteId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): ClienteId {
    return new ClienteId(value);
  }

  static fromString(value: string): ClienteId {
    return new ClienteId(toUuid(value));
  }
}
