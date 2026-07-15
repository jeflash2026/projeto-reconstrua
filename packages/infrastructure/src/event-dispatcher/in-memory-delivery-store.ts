// ─────────────────────────────────────────────────────────────────────────────
// InMemoryDeliveryStore — adapter de ALTA FIDELIDADE do ledger de entregas.
// Implementa fielmente: enqueue idempotente, claimDue com ORDENAÇÃO FIFO por
// (streamType, streamId, subscriber) e head-of-line blocking, lock de worker,
// reschedule (backoff), Dead Letter Queue, releaseStale (recovery), contagem por
// estado e replay de DLQ. Atomicidade por tick: `claimDue` reserva de forma
// síncrona (lê e trava sem await intermediário), portanto reivindicações
// concorrentes não colidem.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ClaimedDelivery,
  DeliveryStore,
  Delivery,
  DeliveryStatus,
  DeliveryStatusCounts,
  StoredEvent,
} from '@reconstrua/application';

interface MutableDelivery {
  id: string;
  eventId: string;
  subscriber: string;
  streamType: string;
  streamId: string;
  version: number;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
}

function toDelivery(m: MutableDelivery): Delivery {
  return { ...m };
}

export class InMemoryDeliveryStore implements DeliveryStore {
  private readonly deliveries = new Map<string, MutableDelivery>();
  private readonly events = new Map<string, StoredEvent>();
  private readonly index = new Set<string>(); // `${eventId}|${subscriber}`
  private seq = 0;

  enqueue(event: StoredEvent, subscribers: readonly string[], now: Date): Promise<void> {
    this.events.set(event.id, event);
    for (const subscriber of subscribers) {
      const key = `${event.id}|${subscriber}`;
      if (this.index.has(key)) continue; // idempotente
      this.index.add(key);
      this.seq += 1;
      this.deliveries.set(`del-${String(this.seq)}`, {
        id: `del-${String(this.seq)}`,
        eventId: event.id,
        subscriber,
        streamType: event.streamType,
        streamId: event.streamId,
        version: event.version,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
        createdAt: now,
        lockedAt: null,
        lockedBy: null,
      });
    }
    return Promise.resolve();
  }

  claimDue(limit: number, now: Date, workerId: string): Promise<readonly ClaimedDelivery[]> {
    // 1) Cabeça de cada grupo (streamType, streamId, subscriber) = menor versão pendente.
    const heads = new Map<string, MutableDelivery>();
    for (const d of this.deliveries.values()) {
      if (d.status !== 'pending') continue;
      const group = `${d.streamType}|${d.streamId}|${d.subscriber}`;
      const current = heads.get(group);
      if (!current || d.version < current.version) {
        heads.set(group, d);
      }
    }
    // 2) Uma cabeça é reivindicável se está DEVIDA e DESTRAVADA (head-of-line blocking).
    const claimable: MutableDelivery[] = [];
    for (const head of heads.values()) {
      if (head.lockedAt === null && head.nextAttemptAt.getTime() <= now.getTime()) {
        claimable.push(head);
      }
    }
    claimable.sort(
      (a, b) =>
        a.streamType.localeCompare(b.streamType) ||
        a.streamId.localeCompare(b.streamId) ||
        a.subscriber.localeCompare(b.subscriber) ||
        a.version - b.version,
    );
    // 3) Trava e devolve (com o evento).
    const result: ClaimedDelivery[] = [];
    for (const d of claimable.slice(0, limit)) {
      d.lockedAt = now;
      d.lockedBy = workerId;
      const event = this.events.get(d.eventId);
      if (event) result.push({ delivery: toDelivery(d), event });
    }
    return Promise.resolve(result);
  }

  markDelivered(deliveryIds: readonly string[], _now: Date): Promise<void> {
    for (const id of deliveryIds) {
      const d = this.deliveries.get(id);
      if (d) {
        d.status = 'delivered';
        d.lockedAt = null;
        d.lockedBy = null;
      }
    }
    return Promise.resolve();
  }

  reschedule(deliveryId: string, nextAttemptAt: Date, attempts: number, error: string): Promise<void> {
    const d = this.deliveries.get(deliveryId);
    if (d) {
      d.attempts = attempts;
      d.nextAttemptAt = nextAttemptAt;
      d.lastError = error;
      d.lockedAt = null;
      d.lockedBy = null;
    }
    return Promise.resolve();
  }

  deadLetter(deliveryId: string, reason: string, attempts: number): Promise<void> {
    const d = this.deliveries.get(deliveryId);
    if (d) {
      d.status = 'dead';
      d.attempts = attempts;
      d.lastError = reason;
      d.lockedAt = null;
      d.lockedBy = null;
    }
    return Promise.resolve();
  }

  releaseStale(olderThan: Date): Promise<number> {
    let released = 0;
    for (const d of this.deliveries.values()) {
      if (d.lockedAt !== null && d.lockedAt.getTime() < olderThan.getTime()) {
        d.lockedAt = null;
        d.lockedBy = null;
        released += 1;
      }
    }
    return Promise.resolve(released);
  }

  countByStatus(): Promise<DeliveryStatusCounts> {
    const counts = { pending: 0, delivered: 0, dead: 0 };
    for (const d of this.deliveries.values()) {
      counts[d.status] += 1;
    }
    return Promise.resolve(counts);
  }

  listDeadLetters(limit: number): Promise<readonly Delivery[]> {
    const dead: Delivery[] = [];
    for (const d of this.deliveries.values()) {
      if (dead.length >= limit) break;
      if (d.status === 'dead') dead.push(toDelivery(d));
    }
    return Promise.resolve(dead);
  }

  replay(deliveryId: string, now: Date): Promise<void> {
    const d = this.deliveries.get(deliveryId);
    if (d && d.status === 'dead') {
      d.status = 'pending';
      d.attempts = 0;
      d.nextAttemptAt = now;
      d.lastError = null;
      d.lockedAt = null;
      d.lockedBy = null;
    }
    return Promise.resolve();
  }
}
