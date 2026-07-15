// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do Estado Operacional — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 08 — o Estado DERIVA automaticamente da Verdade (item 7; R5).
// A derivação é o marco; sua veiculação operacional (R6, via Evento Relevante) e
// persistência pertencem a outras camadas, não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando um Estado Operacional é derivado da Verdade vigente de uma Missão (Entidade 08; INV-EO-02). */
export class OperationalStateDerived extends BaseDomainEvent {
  readonly eventName = 'operational-state.derived';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
