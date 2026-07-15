// ─────────────────────────────────────────────────────────────────────────────
// Event Dispatcher Runtime (Sprint 2A.2) — barrel. Ports + runtime, agnósticos de
// tecnologia. Adapters (in-memory, PostgreSQL) na infraestrutura.
// ─────────────────────────────────────────────────────────────────────────────
export type { DeliveryStatus, Delivery, DeliveryStatusCounts } from './types.js';

export type { RetryDecision, RetryPolicy, ExponentialBackoffOptions } from './retry-policy.js';
export { ExponentialBackoffRetryPolicy } from './retry-policy.js';

export type { DispatchMetrics, DispatchMetricsSnapshot } from './metrics.js';
export { InMemoryDispatchMetrics, NoopDispatchMetrics } from './metrics.js';

export type { ClaimedDelivery, DeliveryStore, IdempotencyStore } from './ports.js';

export type { RegisteredSubscriber } from './subscriber-registry.js';
export { SubscriberRegistry } from './subscriber-registry.js';

export type {
  OutboxRuntimeDeps,
  OutboxRuntimeOptions,
  DeliverResult,
  TickResult,
} from './outbox-runtime.js';
export { OutboxRuntime } from './outbox-runtime.js';
