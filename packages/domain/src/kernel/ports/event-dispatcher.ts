// ─────────────────────────────────────────────────────────────────────────────
// EventDispatcher / DomainEventHandler — ports de propagação de eventos de
// domínio. Interfaces apenas; a implementação (outbox, broker) é infraestrutura.
// Puro.
// ─────────────────────────────────────────────────────────────────────────────
import type { DomainEvent } from '../domain-event.js';

export interface EventDispatcher {
  dispatch(events: ReadonlyArray<DomainEvent>): Promise<void>;
}

export interface DomainEventHandler<TEvent extends DomainEvent> {
  readonly subscribedTo: string;
  handle(event: TEvent): Promise<void>;
}
