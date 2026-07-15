// ─────────────────────────────────────────────────────────────────────────────
// Event Dispatcher Runtime (Sprint 2A.2) — adapters de infraestrutura (barrel).
// ─────────────────────────────────────────────────────────────────────────────
export { InMemoryDeliveryStore } from './in-memory-delivery-store.js';
export { InMemoryIdempotencyStore } from './in-memory-idempotency-store.js';
export { PgDeliveryStore } from './pg-delivery-store.js';
export { PgIdempotencyStore } from './pg-idempotency-store.js';
export { rowToDelivery } from './delivery-row.js';
