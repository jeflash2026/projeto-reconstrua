// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da Regra Operacional — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 12 — a Regra é "comportamento previamente APROVADO" (DF-13,
// item 1/7). A aprovação é o marco da existência da regra; sua EXECUÇÃO (pela
// automação/AHRI), o versionamento e a persistência pertencem a outras camadas,
// não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Regra Operacional é aprovada e passa a existir (Entidade 12; DF-13; INV-RO-01). */
export class OperationalRuleApproved extends BaseDomainEvent {
  readonly eventName = 'operational-rule.approved';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
