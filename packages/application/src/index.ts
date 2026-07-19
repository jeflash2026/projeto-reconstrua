// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/application — Camada de APLICAÇÃO (casos de uso + ports).
//
// Aqui viverão os fluxos operacionais do Livro Mestre (Volume 03, R1–R9) como
// casos de uso, e os PORTS (interfaces) que a infraestrutura implementa.
// Depende do Domínio; nunca da tecnologia concreta.
//
// Sprint 2A.1: Event Store Runtime (ports + motor agnóstico de tecnologia).
// Sprint 2A.2: Event Dispatcher + Outbox Runtime (ledger de entregas).
// ─────────────────────────────────────────────────────────────────────────────
export const LAYER = 'reconstrua/application' as const;

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
export * from './alir/index.js';
export * from './qualification/index.js';
export * from './clientes/index.js';
export * from './pericia/index.js';
export * from './portal-cliente/index.js';
export * from './portal-auth/index.js';
export * from './strategic-reasoning/index.js';
export * from './executive-mind/index.js';
