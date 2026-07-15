// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da AHRI — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 14 — a AHRI pode ASSUMIR a responsabilidade operacional de uma
// missão (DF-09). A assunção é o marco; o raciocínio cognitivo (E9), a declaração
// de incerteza (E10), a atuação (R7/R8), o rastro perpétuo e a persistência
// pertencem a outras camadas, não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando a AHRI assume a responsabilidade operacional de uma Missão (Entidade 14; DF-09; INV-AH-02). */
export class AhriOperationalResponsibilityAssumed extends BaseDomainEvent {
  readonly eventName = 'ahri.operational-responsibility-assumed';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
