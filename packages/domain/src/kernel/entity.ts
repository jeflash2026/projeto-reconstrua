// ─────────────────────────────────────────────────────────────────────────────
// BaseEntity<TId> — entidade com identidade. Igualdade por identidade (não por
// atributos). Puro. Nenhuma dependência de tecnologia.
// ─────────────────────────────────────────────────────────────────────────────
import type { Identity } from './identity/identity.js';

export abstract class BaseEntity<TId extends Identity<unknown>> {
  protected constructor(private readonly _id: TId) {}

  get id(): TId {
    return this._id;
  }

  equals(other?: BaseEntity<TId> | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    if (this.constructor !== other.constructor) {
      return false;
    }
    return this._id.equals(other._id);
  }
}
