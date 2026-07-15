// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da Verdade Operacional — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 07; E8 — a Verdade nasce por SÍNTESE (não por reconhecimento).
// A síntese datada é o marco; sua veiculação operacional (E8-L08) e persistência
// pertencem a R5 / Event Store, não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma nova Verdade Operacional é sintetizada para uma Missão (Entidade 07; E8-L03). */
export class OperationalTruthSynthesized extends BaseDomainEvent {
  readonly eventName = 'operational-truth.synthesized';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
