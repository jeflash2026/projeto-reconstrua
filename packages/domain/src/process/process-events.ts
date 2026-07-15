// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do Processo — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 06 — PROCESSO; Lei do Reconhecimento — o Sistema RECONHECE o
// instrumento jurídico que existe no mundo ("a ação distribuída" — item 20), não
// o inventa. O reconhecimento é o marco; sua veiculação operacional é de sprints
// futuras. Aqui há apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando um Processo é oficialmente reconhecido dentro de sua Missão (Entidade 06; INV-PR-01). */
export class ProcessRecognized extends BaseDomainEvent {
  readonly eventName = 'process.recognized';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
