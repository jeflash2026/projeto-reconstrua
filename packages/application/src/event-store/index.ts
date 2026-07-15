// ─────────────────────────────────────────────────────────────────────────────
// Event Store Runtime (camada Application) — barrel. Ports + motor, agnósticos de
// tecnologia. As implementações (PostgreSQL, in-memory) vivem na infraestrutura.
// ─────────────────────────────────────────────────────────────────────────────
export type {
  StreamType,
  StreamId,
  ExpectedVersion,
  EventProvenance,
  StoredProvenance,
  UncommittedEvent,
  StoredEvent,
  AppendResult,
} from './stored-event.js';
export { NO_STREAM, ANY_VERSION, atVersion, normalizeProvenance } from './stored-event.js';

export {
  EventStoreError,
  ConcurrencyConflictError,
  RelevantEventRequiresFactError,
  EventStoreIntegrityError,
} from './errors.js';

export type {
  Hasher,
  EventStore,
  Snapshot,
  SnapshotStore,
  OutboxStore,
  EventSubscriber,
} from './ports.js';

export type { HashableEvent } from './hash-chain.js';
export { canonicalEventString, computeHash, assertStreamIntegrity, GENESIS } from './hash-chain.js';

export type { Rehydrated, Fold } from './rehydrator.js';
export { rehydrate } from './rehydrator.js';

export type { MapOptions } from './domain-event-mapper.js';
export { toUncommitted } from './domain-event-mapper.js';

export type { EventSourcedRepositoryOptions } from './event-sourced-repository.js';
export { EventSourcedRepository } from './event-sourced-repository.js';

export type { DrainResult, EventDispatcherRuntimeOptions } from './event-dispatcher-runtime.js';
export { EventDispatcherRuntime } from './event-dispatcher-runtime.js';
