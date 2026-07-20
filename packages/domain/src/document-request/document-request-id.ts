// ─────────────────────────────────────────────────────────────────────────────
// DocumentRequestId — identidade da Solicitação Complementar de Documento
// (GO-LIVE 15C · Workflow 2). Deriva do Kernel (Identity<Uuid>).
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class DocumentRequestId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): DocumentRequestId {
    return new DocumentRequestId(value);
  }

  static fromString(value: string): DocumentRequestId {
    return new DocumentRequestId(toUuid(value));
  }
}
