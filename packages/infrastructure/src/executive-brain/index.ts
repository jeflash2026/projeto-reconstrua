// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/infrastructure — Executive Brain adapters (Sprint 2C).
// Catálogo de regras, snapshot/resolver/auditoria in-memory, o adapter para a
// Conversa (2B) e a raiz de composição.
// ─────────────────────────────────────────────────────────────────────────────
export * from './default-rule-catalog.js';
export * from './in-memory-adapters.js';
export * from './conversation-brain-adapter.js';
export * from './build-executive-brain.js';
// RFC-0035-G: fronteira de decisão como Read Model Projection (Alternativa B).
export * from './decision-state-read-model.js';
export * from './decision-state-projection-subscriber.js';
export * from './projection-backed-mission-snapshot-adapter.js';
