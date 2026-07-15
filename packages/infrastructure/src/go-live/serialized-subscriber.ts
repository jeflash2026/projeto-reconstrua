// ─────────────────────────────────────────────────────────────────────────────
// SerializedSubscriber — decorator ADITIVO (2F) sobre qualquer `EventSubscriber`.
// O Dispatcher (2A.2) entrega streams DIFERENTES em paralelo; subscribers que fazem
// read-modify-write num único documento (ex.: AdminMetrics, progresso de workflow)
// perderiam incrementos (last-write-wins). Este decorator serializa `handle` numa
// fila de promessas — correção de concorrência SEM tocar 2A.2 nem 2E (congelados).
// ─────────────────────────────────────────────────────────────────────────────
import type { EventSubscriber, StoredEvent } from '@reconstrua/application';

export class SerializedSubscriber implements EventSubscriber {
  readonly name: string;
  readonly interestedIn?: readonly string[];
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly inner: EventSubscriber) {
    this.name = inner.name;
    if (inner.interestedIn !== undefined) this.interestedIn = inner.interestedIn;
  }

  handle(event: StoredEvent): Promise<void> {
    const next = this.queue.then(() => this.inner.handle(event));
    // A fila nunca quebra (o erro é propagado ao chamador, não à cadeia).
    this.queue = next.catch(() => undefined);
    return next;
  }
}
