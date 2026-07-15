// ─────────────────────────────────────────────────────────────────────────────
// AggregateRoot<TId> — raiz de agregado. Acumula DomainEvents produzidos durante
// operações; a camada de aplicação os extrai (pull) e os despacha após persistir.
// Puro. Nenhuma dependência de tecnologia.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseEntity } from './entity.js';
import type { Identity } from './identity/identity.js';
import type { DomainEvent } from './domain-event.js';

export abstract class AggregateRoot<TId extends Identity<unknown>> extends BaseEntity<TId> {
  private _domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /** Retorna e limpa os eventos acumulados (consumo único). */
  pullDomainEvents(): readonly DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return Object.freeze(events);
  }

  hasPendingEvents(): boolean {
    return this._domainEvents.length > 0;
  }
}
