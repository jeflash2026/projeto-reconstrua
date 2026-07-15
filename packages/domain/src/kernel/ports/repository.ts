// ─────────────────────────────────────────────────────────────────────────────
// Repository — port de persistência de agregados. Interface apenas; a
// implementação (event store, etc.) vive na infraestrutura. Puro.
// `Promise` é primitiva da linguagem (não é tecnologia de infra).
// ─────────────────────────────────────────────────────────────────────────────
import type { AggregateRoot } from '../aggregate-root.js';
import type { Identity } from '../identity/identity.js';

export interface Repository<TAggregate extends AggregateRoot<Identity<unknown>>, TId> {
  findById(id: TId): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
}
