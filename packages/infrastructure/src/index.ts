// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/infrastructure — Camada de INFRAESTRUTURA (adaptadores substituíveis).
//
// Aqui viverão os adaptadores dos ports da Aplicação:
//   • Event Store (PostgreSQL, append-only);
//   • projeções / Read Models (Verdade Operacional);
//   • Transactional Outbox;
//   • gateways externos.
// Tudo trocável sem tocar Domínio/Aplicação (Preâmbulo do Volume 00; Lei 5).
//
// Sprint 2A.1: Event Store Runtime (adapters PostgreSQL + in-memory).
// Sprint 2A.2: Event Dispatcher + Outbox Runtime (adapters do ledger de entregas).
// ─────────────────────────────────────────────────────────────────────────────
export const LAYER = 'reconstrua/infrastructure' as const;

export * from './event-store/index.js';
export * from './event-dispatcher/index.js';
export * from './conversation/index.js';
export * from './executive-brain/index.js';
export * from './mission-runtime/index.js';
export * from './living-memory/index.js';
export * from './administration/index.js';
export * from './go-live/index.js';
export * from './admin-portal/index.js';
export * from './advogado-portal/index.js';
export * from './lawyer-experience/index.js';
export * from './production/index.js';
export * from './migrations/index.js';
