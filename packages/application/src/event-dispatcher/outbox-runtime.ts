// ─────────────────────────────────────────────────────────────────────────────
// OutboxRuntime — o runtime de propagação confiável. Duas fases:
//  1) FAN-OUT: lê os eventos prontos na outbox (gravada atomicamente no append),
//     descobre os subscribers interessados (registry) e cria uma ENTREGA por
//     (evento × subscriber) no ledger durável; marca o evento como distribuído.
//  2) ENTREGA: reivindica (com lock) as entregas devidas — na ordem FIFO por
//     stream×subscriber — e as processa com IDEMPOTÊNCIA, ISOLAMENTO DE FALHAS,
//     RETRY com BACKOFF e Dead Letter Queue (poison). RECOVERY libera locks de
//     workers mortos.
//
// Garantias: ao-menos-uma-vez (a entrega só sai da fila quando confirmada);
// efetivamente-uma-vez quando o subscriber usa a idempotência; sem perda (nada é
// apagado — apenas transita entre estados); ordenação por stream preservada
// (head-of-line por versão); isolamento (a falha de um subscriber não afeta os
// demais, pois cada um tem sua própria entrega).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { OutboxStore } from '../event-store/index.js';
import type { DeliveryStore, IdempotencyStore } from './ports.js';
import type { RetryPolicy } from './retry-policy.js';
import type { DispatchMetrics } from './metrics.js';
import { NoopDispatchMetrics } from './metrics.js';
import type { SubscriberRegistry } from './subscriber-registry.js';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'erro desconhecido';
}

export interface OutboxRuntimeDeps {
  readonly outbox: OutboxStore;
  readonly deliveries: DeliveryStore;
  readonly idempotency: IdempotencyStore;
  readonly registry: SubscriberRegistry;
  readonly retryPolicy: RetryPolicy;
  readonly clock: Clock;
  readonly metrics?: DispatchMetrics;
}

export interface OutboxRuntimeOptions {
  readonly fanOutBatch?: number;
  readonly deliverBatch?: number;
  readonly workerId?: string;
  /** Lock considerado obsoleto (worker morto) após este tempo (ms). */
  readonly staleLockMs?: number;
}

export interface DeliverResult {
  readonly claimed: number;
  readonly delivered: number;
  readonly retried: number;
  readonly deadLettered: number;
  readonly skipped: number;
}

export interface TickResult {
  readonly fannedOut: number;
  readonly deliver: DeliverResult;
}

export class OutboxRuntime {
  private readonly outbox: OutboxStore;
  private readonly deliveries: DeliveryStore;
  private readonly idempotency: IdempotencyStore;
  private readonly registry: SubscriberRegistry;
  private readonly retryPolicy: RetryPolicy;
  private readonly clock: Clock;
  private readonly metrics: DispatchMetrics;
  private readonly fanOutBatch: number;
  private readonly deliverBatch: number;
  private readonly workerId: string;
  private readonly staleLockMs: number;

  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;

  constructor(deps: OutboxRuntimeDeps, options: OutboxRuntimeOptions = {}) {
    this.outbox = deps.outbox;
    this.deliveries = deps.deliveries;
    this.idempotency = deps.idempotency;
    this.registry = deps.registry;
    this.retryPolicy = deps.retryPolicy;
    this.clock = deps.clock;
    this.metrics = deps.metrics ?? new NoopDispatchMetrics();
    this.fanOutBatch = options.fanOutBatch ?? 100;
    this.deliverBatch = options.deliverBatch ?? 100;
    this.workerId = options.workerId ?? 'worker-1';
    this.staleLockMs = options.staleLockMs ?? 30_000;
  }

  /** Fase 1 — distribui eventos prontos em entregas por subscriber. Retorna nº de eventos distribuídos. */
  async fanOutOnce(): Promise<number> {
    const now = this.clock.now();
    const events = await this.outbox.fetchUnpublished(this.fanOutBatch);
    const publishedIds: string[] = [];
    for (const event of events) {
      const subscribers = this.registry.interestedIn(event);
      if (subscribers.length > 0) {
        await this.deliveries.enqueue(event, subscribers, now);
        this.metrics.onFannedOut(subscribers.length);
      }
      publishedIds.push(event.id);
    }
    if (publishedIds.length > 0) {
      await this.outbox.markPublished(publishedIds);
    }
    return events.length;
  }

  /** Fase 2 — processa as entregas devidas (ordenadas, idempotentes, isoladas). */
  async deliverOnce(): Promise<DeliverResult> {
    const now = this.clock.now();
    const claimed = await this.deliveries.claimDue(this.deliverBatch, now, this.workerId);

    let delivered = 0;
    let retried = 0;
    let deadLettered = 0;
    let skipped = 0;

    // Entregas de grupos (stream×subscriber) distintos → processáveis em paralelo
    // com isolamento total (cada uma com try/catch próprio).
    await Promise.all(
      claimed.map(async ({ delivery, event }) => {
        const sub = delivery.subscriber;
        try {
          if (await this.idempotency.wasProcessed(sub, event.id)) {
            await this.deliveries.markDelivered([delivery.id], this.clock.now());
            this.metrics.onSkippedIdempotent(sub);
            skipped += 1;
            return;
          }
          const handler = this.registry.get(sub);
          if (!handler) {
            throw new Error(`subscriber '${sub}' não está registrado`);
          }
          const t0 = this.clock.now().getTime();
          await handler.handle(event);
          const processMs = this.clock.now().getTime() - t0;
          await this.idempotency.recordProcessed(sub, event.id, this.clock.now());
          await this.deliveries.markDelivered([delivery.id], this.clock.now());
          const queueMs = Math.max(0, this.clock.now().getTime() - delivery.createdAt.getTime());
          this.metrics.onDelivered(sub, queueMs, processMs);
          delivered += 1;
        } catch (error) {
          const attempts = delivery.attempts + 1;
          this.metrics.onFailed(sub, attempts);
          const decision = this.retryPolicy.decide(attempts);
          if (decision.retry) {
            const nextAttemptAt = new Date(this.clock.now().getTime() + decision.delayMs);
            await this.deliveries.reschedule(
              delivery.id,
              nextAttemptAt,
              attempts,
              errorMessage(error),
            );
            this.metrics.onRetried(sub);
            retried += 1;
          } else {
            await this.deliveries.deadLetter(delivery.id, errorMessage(error), attempts);
            this.metrics.onDeadLettered(sub);
            deadLettered += 1;
          }
        }
      }),
    );

    return { claimed: claimed.length, delivered, retried, deadLettered, skipped };
  }

  /** Recovery — libera locks de entregas travadas por workers mortos. Retorna nº liberado. */
  async recoverOnce(): Promise<number> {
    const olderThan = new Date(this.clock.now().getTime() - this.staleLockMs);
    const released = await this.deliveries.releaseStale(olderThan);
    if (released > 0) this.metrics.onRecovered(released);
    return released;
  }

  /** Um ciclo completo: recovery + fan-out + entrega. */
  async tick(): Promise<TickResult> {
    await this.recoverOnce();
    const fannedOut = await this.fanOutOnce();
    const deliver = await this.deliverOnce();
    return { fannedOut, deliver };
  }

  /**
   * Drena até ficar ocioso (uso em testes/jobs pontuais): repete tick enquanto
   * houver progresso (fan-out > 0 ou alguma entrega processada). Entregas
   * reagendadas para o futuro NÃO contam como progresso — evita laço infinito.
   */
  async drainToIdle(maxIterations = 10_000): Promise<void> {
    for (let i = 0; i < maxIterations; i += 1) {
      const fannedOut = await this.fanOutOnce();
      const deliver = await this.deliverOnce();
      const progress =
        fannedOut > 0 || deliver.delivered > 0 || deliver.skipped > 0 || deliver.deadLettered > 0;
      if (!progress) return;
    }
  }

  /** Dispatch ASSÍNCRONO: laço de polling em produção. */
  start(intervalMs = 200): void {
    if (!this.stopped) return;
    this.stopped = false;
    const loop = async (): Promise<void> => {
      if (this.stopped) return;
      try {
        await this.tick();
      } catch {
        // Falha do ciclo é observável; o loop continua (nada se perde — retry na próxima).
      }
      if (!this.stopped) {
        this.timer = setTimeout(() => void loop(), intervalMs);
      }
    };
    this.timer = setTimeout(() => void loop(), intervalMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
