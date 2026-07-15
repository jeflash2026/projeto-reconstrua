// ─────────────────────────────────────────────────────────────────────────────
// Kernel do Domínio — primitivas puras (Sprint 1A). Zero tecnologia.
// Nenhuma entidade do Livro Mestre, nenhuma regra operacional, nenhuma API.
// ─────────────────────────────────────────────────────────────────────────────

// Funcionais
export { Result } from './result.js';
export { Either } from './either.js';

// Tempo
export type { Clock } from './clock.js';

// Erros
export { DomainError } from './errors/domain-error.js';
export { CanonViolationError } from './errors/canon-violation-error.js';
export type { CanonViolationDetails } from './errors/canon-violation-error.js';

// Identidade
export { Identity } from './identity/identity.js';
export { toUuid, isUuid } from './identity/uuid.js';
export type { Uuid, UuidGenerator } from './identity/uuid.js';

// Blocos de modelagem
export { ValueObject } from './value-object.js';
export { BaseEntity } from './entity.js';
export { AggregateRoot } from './aggregate-root.js';
export { BaseDomainEvent } from './domain-event.js';
export type { DomainEvent } from './domain-event.js';

// Regras e conformidade
export { CompositeSpecification, spec } from './specification.js';
export type { Specification } from './specification.js';
export { defineInvariant, invariantFromSpec } from './invariant.js';
export type { Invariant } from './invariant.js';
export { InvariantsEngine } from './invariants-engine.js';
export { ConformanceRegistry } from './conformance-engine.js';
export type { ConformanceEntry } from './conformance-engine.js';

// Ports oficiais
export type {
  Repository,
  UnitOfWork,
  EventDispatcher,
  DomainEventHandler,
  ReadModel,
  ReadModelStore,
  Projector,
} from './ports/index.js';
