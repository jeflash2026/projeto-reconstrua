// ─────────────────────────────────────────────────────────────────────────────
// AdminMetricsStore + AdminProjectionSubscriber — o READ MODEL administrativo e o
// assinante que o alimenta. O subscriber implementa o port CONGELADO `EventSubscriber`
// de 2A: o Dispatcher (2A.2) entrega cada evento de domínio e a projeção incrementa
// as métricas (idempotente por globalSeq). CQRS: lê eventos, nunca muta domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AdminMetrics,
  AdminMetricsStore,
  EventSubscriber,
  StoredEvent,
} from '@reconstrua/application';
import { emptyMetrics, projectEvent } from '@reconstrua/application';

export class InMemoryAdminMetricsStore implements AdminMetricsStore {
  private metrics: AdminMetrics | null = null;
  load(): Promise<AdminMetrics | null> {
    return Promise.resolve(this.metrics);
  }
  save(metrics: AdminMetrics): Promise<void> {
    this.metrics = metrics;
    return Promise.resolve();
  }
}

export class AdminProjectionSubscriber implements EventSubscriber {
  readonly name = 'admin-metrics';
  constructor(private readonly store: AdminMetricsStore) {}

  async handle(event: StoredEvent): Promise<void> {
    const current = (await this.store.load()) ?? emptyMetrics(event.recordedAt);
    const next = projectEvent(current, event);
    if (next !== current) await this.store.save(next);
  }
}
