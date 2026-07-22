// ─────────────────────────────────────────────────────────────────────────────
// ValueObject<Props> — objeto de valor imutável, com igualdade estrutural.
// Puro. Nenhuma dependência de tecnologia.
// ─────────────────────────────────────────────────────────────────────────────

function structuralEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => structuralEquals(item, b[index]));
  }
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length || !aKeys.every((k, i) => k === bKeys[i])) {
    return false;
  }
  return aKeys.every((key) =>
    structuralEquals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

export abstract class ValueObject<Props extends Record<string, unknown>> {
  protected readonly props: Readonly<Props>;

  protected constructor(props: Props) {
    this.props = Object.freeze({ ...props });
  }

  equals(other?: ValueObject<Props> | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    if (this.constructor !== other.constructor) {
      return false;
    }
    return structuralEquals(this.props, other.props);
  }
}
