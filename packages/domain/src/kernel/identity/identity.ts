// ─────────────────────────────────────────────────────────────────────────────
// Identity<TValue> — identidade abstrata de entidades. Igualdade por valor +
// tipo concreto. Imutável. Puro.
// ─────────────────────────────────────────────────────────────────────────────

export abstract class Identity<TValue = string> {
  protected constructor(public readonly value: TValue) {
    Object.freeze(this);
  }

  equals(other?: Identity<TValue> | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    // Mesma classe concreta e mesmo valor.
    return this.constructor === other.constructor && this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
