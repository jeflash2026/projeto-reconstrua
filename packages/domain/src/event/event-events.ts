// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da entidade EVENTO — CONTRATOS VAZIOS, sem infraestrutura.
// (Nota: `EventRecognized` é um DomainEvent do Kernel que sinaliza que a entidade
// ontológica EVENTO foi reconhecida — não confundir os dois conceitos.)
// Canon: Lei Epistemológica nº 1 — o Sistema RECONHECE (nunca inventa) um evento.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando um Evento (Entidade 04) é oficialmente reconhecido. */
export class EventRecognized extends BaseDomainEvent {
  readonly eventName = 'event.recognized';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
