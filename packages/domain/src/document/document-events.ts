// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do Documento — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 03 / INV-D01 — o Sistema RECONHECE (nunca cria) um Documento
// preexistente. O reconhecimento é o marco; sua veiculação operacional é de
// sprints futuras. Aqui há apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando um Documento é oficialmente reconhecido (Entidade 03; INV-D01/D08). */
export class DocumentRecognized extends BaseDomainEvent {
  readonly eventName = 'document.recognized';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
