// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do Caso — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 05 — CASO; princípio do fundador "Caso é reconhecido, nunca
// inventado". O reconhecimento é o marco; sua veiculação operacional é de sprints
// futuras. Aqui há apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando um Caso é oficialmente reconhecido dentro de sua Missão (Entidade 05; INV-CA-01). */
export class CaseRecognized extends BaseDomainEvent {
  readonly eventName = 'case.recognized';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
