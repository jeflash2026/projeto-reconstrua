// ─────────────────────────────────────────────────────────────────────────────
// OperationalRuleId — identidade (Uuid) da Regra Operacional. Deriva do Kernel.
// Canon: Entidade 12 — REGRA OPERACIONAL. NÃO confundir com o "identificador único"
// RO-Rn-NNN (elemento 1 da DF-13), que é o CÓDIGO de negócio da regra (RuleCode):
// aqui está a identidade técnica do agregado; lá, o identificador oficial da norma.
// ─────────────────────────────────────────────────────────────────────────────
import { Identity } from '../kernel/identity/identity.js';
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

export class OperationalRuleId extends Identity<Uuid> {
  private constructor(value: Uuid) {
    super(value);
  }

  static fromUuid(value: Uuid): OperationalRuleId {
    return new OperationalRuleId(value);
  }

  static fromString(value: string): OperationalRuleId {
    return new OperationalRuleId(toUuid(value));
  }
}
