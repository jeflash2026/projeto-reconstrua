// ─────────────────────────────────────────────────────────────────────────────
// InMemoryIdempotencyStore — registra (subscriber × evento) já processados, para
// garantir que um subscriber jamais processe duas vezes o mesmo evento.
// ─────────────────────────────────────────────────────────────────────────────
import type { IdempotencyStore } from '@reconstrua/application';

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Set<string>();

  private key(subscriber: string, eventId: string): string {
    return `${subscriber}|${eventId}`;
  }

  wasProcessed(subscriber: string, eventId: string): Promise<boolean> {
    return Promise.resolve(this.processed.has(this.key(subscriber, eventId)));
  }

  recordProcessed(subscriber: string, eventId: string, _now: Date): Promise<void> {
    this.processed.add(this.key(subscriber, eventId));
    return Promise.resolve();
  }
}
