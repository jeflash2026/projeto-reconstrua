// ─────────────────────────────────────────────────────────────────────────────
// Subscriber Registry — registro DINÂMICO de subscribers, com VERSIONAMENTO e
// DESCOBERTA. Os subscribers (CQRS, Notifications, Workflow, Scheduler, Learning,
// Relationship) registram-se aqui; o Outbox Runtime descobre quais são interessados
// em cada evento. Reutiliza o port `EventSubscriber` do event store (não o altera).
// ─────────────────────────────────────────────────────────────────────────────
import type { EventSubscriber, StoredEvent } from '../event-store/index.js';

export interface RegisteredSubscriber {
  readonly subscriber: EventSubscriber;
  readonly version: number;
  readonly registeredAt: Date;
}

export class SubscriberRegistry {
  private readonly entries = new Map<string, RegisteredSubscriber>();

  /** Registra (ou re-registra, atualizando versão) um subscriber dinamicamente. */
  register(subscriber: EventSubscriber, version = 1, now: Date = new Date()): this {
    this.entries.set(subscriber.name, { subscriber, version, registeredAt: now });
    return this;
  }

  /** Remove um subscriber do registro. */
  unregister(name: string): boolean {
    return this.entries.delete(name);
  }

  /** Recupera um subscriber pelo nome (descoberta). */
  get(name: string): EventSubscriber | undefined {
    return this.entries.get(name)?.subscriber;
  }

  /** Versão registrada de um subscriber. */
  versionOf(name: string): number | undefined {
    return this.entries.get(name)?.version;
  }

  /** Lista todos os subscribers registrados (descoberta). */
  all(): readonly RegisteredSubscriber[] {
    return [...this.entries.values()];
  }

  /** Nomes dos subscribers interessados em um evento (interestedIn ausente = todos). */
  interestedIn(event: StoredEvent): readonly string[] {
    const names: string[] = [];
    for (const { subscriber } of this.entries.values()) {
      if (
        subscriber.interestedIn === undefined ||
        subscriber.interestedIn.includes(event.eventType)
      ) {
        names.push(subscriber.name);
      }
    }
    return names;
  }
}
