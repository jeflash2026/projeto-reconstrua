// ─────────────────────────────────────────────────────────────────────────────
// Event Store Runtime — adapters de infraestrutura (barrel). Implementam os ports
// definidos em @reconstrua/application. Tecnologia (postgres, crypto) confinada aqui.
// ─────────────────────────────────────────────────────────────────────────────
export { CryptoHasher } from './crypto-hasher.js';
export { SystemClock, UuidV4Generator } from './system-clock.js';
export { InMemoryEventStore } from './in-memory-event-store.js';
export { InMemorySnapshotStore } from './in-memory-snapshot-store.js';
export type { SqlClient, SqlRow } from './sql-client.js';
export type { PostgresSqlClientOptions } from './postgres-sql-client.js';
export { PostgresSqlClient } from './postgres-sql-client.js';
export { PgEventStore } from './pg-event-store.js';
export { PgOutboxStore } from './pg-outbox-store.js';
export { PgSnapshotStore } from './pg-snapshot-store.js';
export { rowToStoredEvent, asDate, asStringOrNull } from './event-row.js';
