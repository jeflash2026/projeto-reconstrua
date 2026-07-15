// ─────────────────────────────────────────────────────────────────────────────
// Ports do Event Dispatcher Runtime (Sprint 2A.2). Interfaces apenas; adapters
// (in-memory, PostgreSQL) na infraestrutura. Reutilizam os tipos do event store
// (StoredEvent) sem alterá-los.
// ─────────────────────────────────────────────────────────────────────────────
import type { StoredEvent } from '../event-store/index.js';
import type { Delivery, DeliveryStatusCounts } from './types.js';

/** Uma entrega reivindicada (com lock) junto do seu evento. */
export interface ClaimedDelivery {
  readonly delivery: Delivery;
  readonly event: StoredEvent;
}

/**
 * Ledger DURÁVEL de entregas. Persiste as entregas (uma por evento × subscriber),
 * com lock, backoff, DLQ e recovery. `claimDue` respeita a ordenação FIFO por
 * (streamType, streamId, subscriber): só entrega a MENOR versão pendente de cada
 * stream×subscriber (head-of-line), garantindo ordem mesmo com concorrência.
 */
export interface DeliveryStore {
  /** Cria entregas pendentes para um evento aos subscribers dados. IDEMPOTENTE por (eventId, subscriber). */
  enqueue(event: StoredEvent, subscribers: readonly string[], now: Date): Promise<void>;

  /** Reivindica (com lock) as entregas devidas, respeitando ordenação por stream. */
  claimDue(limit: number, now: Date, workerId: string): Promise<readonly ClaimedDelivery[]>;

  /** Marca entregas como entregues (e libera o lock). */
  markDelivered(deliveryIds: readonly string[], now: Date): Promise<void>;

  /** Reagenda uma entrega para nova tentativa (backoff); libera o lock. */
  reschedule(deliveryId: string, nextAttemptAt: Date, attempts: number, error: string): Promise<void>;

  /** Move uma entrega para a Dead Letter Queue (mensagem envenenada). */
  deadLetter(deliveryId: string, reason: string, attempts: number): Promise<void>;

  /** Recovery: libera locks de entregas travadas antes de `olderThan` (worker morto). Retorna quantas. */
  releaseStale(olderThan: Date): Promise<number>;

  /** Observabilidade: contagem por estado. */
  countByStatus(): Promise<DeliveryStatusCounts>;

  /** Lista entregas na Dead Letter Queue. */
  listDeadLetters(limit: number): Promise<readonly Delivery[]>;

  /** Reprocessa uma entrega da DLQ: volta a pendente (attempts zerado). */
  replay(deliveryId: string, now: Date): Promise<void>;
}

/**
 * Camada de IDEMPOTÊNCIA: registra que um subscriber processou um evento, para
 * jamais processá-lo duas vezes (entrega ao-menos-uma-vez + dedupe = efetivamente
 * uma vez, do ponto de vista do ledger).
 */
export interface IdempotencyStore {
  wasProcessed(subscriber: string, eventId: string): Promise<boolean>;
  recordProcessed(subscriber: string, eventId: string, now: Date): Promise<void>;
}
