// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da Projeção — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 10 — a Projeção é uma leitura DERIVADA da Verdade (item 1);
// recalcula-se quando a Verdade muda (item 8). A derivação é o marco; o recálculo,
// a persistência e a veiculação de leitura pertencem a outras camadas, não aqui.
// Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Projeção é derivada da Verdade vigente (Entidade 10; INV-PJ-01). */
export class ProjectionDerived extends BaseDomainEvent {
  readonly eventName = 'projection.derived';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
