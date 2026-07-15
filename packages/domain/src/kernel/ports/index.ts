// ─────────────────────────────────────────────────────────────────────────────
// Ports oficiais do domínio. Todos são INTERFACES — implementados fora do
// domínio. Nenhum importa tecnologia.
// ─────────────────────────────────────────────────────────────────────────────
export type { Repository } from './repository.js';
export type { UnitOfWork } from './unit-of-work.js';
export type { EventDispatcher, DomainEventHandler } from './event-dispatcher.js';
export type { ReadModel, ReadModelStore, Projector } from './read-model.js';
