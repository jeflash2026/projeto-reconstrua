// ─────────────────────────────────────────────────────────────────────────────
// DocumentId — identidade do Documento. Deriva do Kernel (Identity<Uuid>).
// Canon: Entidade 03 — DOCUMENTO; a individualização única (INV-D13) tem por base
// a identidade única do documento reconhecido.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class DocumentId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): DocumentId {
    return new DocumentId(value);
  }

  static fromString(value: string): DocumentId {
    return new DocumentId(toUuid(value));
  }
}
