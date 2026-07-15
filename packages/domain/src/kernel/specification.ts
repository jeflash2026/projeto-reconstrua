// ─────────────────────────────────────────────────────────────────────────────
// Specification<T> — predicado de domínio componível (and/or/not).
// Puro. Nenhuma dependência de tecnologia.
// ─────────────────────────────────────────────────────────────────────────────

export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
}

export abstract class CompositeSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification<T>(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification<T>(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification<T>(this);
  }
}

class AndSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }
  override isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

class OrSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }
  override isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

class NotSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly spec: Specification<T>) {
    super();
  }
  override isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}

/** Cria uma Specification a partir de um predicado simples. */
export function spec<T>(predicate: (candidate: T) => boolean): CompositeSpecification<T> {
  return new (class extends CompositeSpecification<T> {
    override isSatisfiedBy(candidate: T): boolean {
      return predicate(candidate);
    }
  })();
}
