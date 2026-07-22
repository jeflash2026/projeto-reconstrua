// ─────────────────────────────────────────────────────────────────────────────
// Event Dispatcher Runtime — drena a Transactional Outbox e faz o FAN-OUT dos
// eventos para os assinantes: CQRS, Notifications, Workflow, Scheduler, Learning,
// Relationship. Entrega AO-MENOS-UMA-VEZ (os assinantes devem ser idempotentes).
//
// Garantia: um evento só é marcado como publicado quando TODOS os assinantes
// interessados o processam com sucesso. Se algum falhar, o evento permanece na
// outbox e será reentregue (a todos os interessados) — por isso a idempotência é
// contratual. Nada se perde (Lei 3); tudo permanece auditável (Lei 4).
// ─────────────────────────────────────────────────────────────────────────────
import type { EventSubscriber, OutboxStore } from './ports.js';
import type { StoredEvent } from './stored-event.js';

export interface DrainResult {
  readonly fetched: number;
  readonly published: number;
  readonly failed: number;
}

export interface EventDispatcherRuntimeOptions {
  /** Tamanho do lote por drenagem (default 100). */
  readonly batchSize?: number;
  /** Chamado quando um assinante falha (observabilidade — separado da auditoria). */
  readonly onSubscriberError?: (subscriber: string, event: StoredEvent, error: unknown) => void;
}

export class EventDispatcherRuntime {
  private readonly outbox: OutboxStore;
  private readonly batchSize: number;
  private readonly onSubscriberError:
    ((subscriber: string, event: StoredEvent, error: unknown) => void) | undefined;
  private readonly subscribers: EventSubscriber[] = [];

  constructor(outbox: OutboxStore, options: EventDispatcherRuntimeOptions = {}) {
    this.outbox = outbox;
    this.batchSize = options.batchSize ?? 100;
    this.onSubscriberError = options.onSubscriberError;
  }

  /** Registra um assinante (CQRS, Notifications, Workflow, Scheduler, Learning, Relationship). */
  register(subscriber: EventSubscriber): this {
    this.subscribers.push(subscriber);
    return this;
  }

  private interested(subscriber: EventSubscriber, event: StoredEvent): boolean {
    return (
      subscriber.interestedIn === undefined || subscriber.interestedIn.includes(event.eventType)
    );
  }

  /**
   * Drena um lote da outbox. Cada evento é despachado a todos os assinantes
   * interessados; só é publicado se todos tiverem sucesso.
   */
  async drainOnce(): Promise<DrainResult> {
    const events = await this.outbox.fetchUnpublished(this.batchSize);
    const publishedIds: string[] = [];
    const failedIds: string[] = [];

    for (const event of events) {
      let allOk = true;
      for (const subscriber of this.subscribers) {
        if (!this.interested(subscriber, event)) {
          continue;
        }
        try {
          await subscriber.handle(event);
        } catch (error) {
          allOk = false;
          this.onSubscriberError?.(subscriber.name, event, error);
        }
      }
      if (allOk) {
        publishedIds.push(event.id);
      } else {
        failedIds.push(event.id);
      }
    }

    if (publishedIds.length > 0) {
      await this.outbox.markPublished(publishedIds);
    }
    if (failedIds.length > 0) {
      await this.outbox.recordFailure(failedIds);
    }

    return { fetched: events.length, published: publishedIds.length, failed: failedIds.length };
  }
}
