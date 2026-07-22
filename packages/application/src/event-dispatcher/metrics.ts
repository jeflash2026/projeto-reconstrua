// ─────────────────────────────────────────────────────────────────────────────
// Observabilidade do dispatcher (métricas). SEPARADA da Auditoria Constitucional
// (DF-03; ADR-0001 item 10): estas métricas informam operação, jamais constituem
// verdade nem substituem o histórico do event store.
// ─────────────────────────────────────────────────────────────────────────────

export interface DispatchMetricsSnapshot {
  readonly fannedOut: number;
  readonly delivered: number;
  readonly failed: number;
  readonly retried: number;
  readonly deadLettered: number;
  readonly recovered: number;
  readonly skippedIdempotent: number;
  /** Tempo total de processamento dos handlers (ms). */
  readonly totalProcessMs: number;
  /** Tempo total em fila até a entrega (ms). */
  readonly totalQueueMs: number;
  /** Média de processamento por entrega (ms). */
  readonly avgProcessMs: number;
  /** Média de tempo em fila por entrega (ms). */
  readonly avgQueueMs: number;
}

/** Port de coleta de métricas do dispatcher. */
export interface DispatchMetrics {
  onFannedOut(count: number): void;
  onDelivered(subscriber: string, queueMs: number, processMs: number): void;
  onFailed(subscriber: string, attempt: number): void;
  onRetried(subscriber: string): void;
  onDeadLettered(subscriber: string): void;
  onRecovered(count: number): void;
  onSkippedIdempotent(subscriber: string): void;
  snapshot(): DispatchMetricsSnapshot;
}

/** Coletor em memória (contadores + tempos, com quebra por subscriber). */
export class InMemoryDispatchMetrics implements DispatchMetrics {
  private fannedOut = 0;
  private delivered = 0;
  private failed = 0;
  private retried = 0;
  private deadLettered = 0;
  private recovered = 0;
  private skippedIdempotent = 0;
  private totalProcessMs = 0;
  private totalQueueMs = 0;
  private readonly perSubscriber = new Map<
    string,
    { delivered: number; failed: number; dead: number }
  >();

  private sub(name: string): { delivered: number; failed: number; dead: number } {
    let entry = this.perSubscriber.get(name);
    if (!entry) {
      entry = { delivered: 0, failed: 0, dead: 0 };
      this.perSubscriber.set(name, entry);
    }
    return entry;
  }

  onFannedOut(count: number): void {
    this.fannedOut += count;
  }
  onDelivered(subscriber: string, queueMs: number, processMs: number): void {
    this.delivered += 1;
    this.totalQueueMs += queueMs;
    this.totalProcessMs += processMs;
    this.sub(subscriber).delivered += 1;
  }
  onFailed(subscriber: string, _attempt: number): void {
    this.failed += 1;
    this.sub(subscriber).failed += 1;
  }
  onRetried(_subscriber: string): void {
    this.retried += 1;
  }
  onDeadLettered(subscriber: string): void {
    this.deadLettered += 1;
    this.sub(subscriber).dead += 1;
  }
  onRecovered(count: number): void {
    this.recovered += count;
  }
  onSkippedIdempotent(_subscriber: string): void {
    this.skippedIdempotent += 1;
  }

  snapshot(): DispatchMetricsSnapshot {
    return {
      fannedOut: this.fannedOut,
      delivered: this.delivered,
      failed: this.failed,
      retried: this.retried,
      deadLettered: this.deadLettered,
      recovered: this.recovered,
      skippedIdempotent: this.skippedIdempotent,
      totalProcessMs: this.totalProcessMs,
      totalQueueMs: this.totalQueueMs,
      avgProcessMs: this.delivered === 0 ? 0 : this.totalProcessMs / this.delivered,
      avgQueueMs: this.delivered === 0 ? 0 : this.totalQueueMs / this.delivered,
    };
  }

  /** Quebra por subscriber (observabilidade adicional). */
  bySubscriber(name: string): { delivered: number; failed: number; dead: number } {
    return { ...this.sub(name) };
  }
}

/** Métricas no-op (quando observabilidade não é necessária). */
export class NoopDispatchMetrics implements DispatchMetrics {
  onFannedOut(): void {}
  onDelivered(): void {}
  onFailed(): void {}
  onRetried(): void {}
  onDeadLettered(): void {}
  onRecovered(): void {}
  onSkippedIdempotent(): void {}
  snapshot(): DispatchMetricsSnapshot {
    return {
      fannedOut: 0,
      delivered: 0,
      failed: 0,
      retried: 0,
      deadLettered: 0,
      recovered: 0,
      skippedIdempotent: 0,
      totalProcessMs: 0,
      totalQueueMs: 0,
      avgProcessMs: 0,
      avgQueueMs: 0,
    };
  }
}
