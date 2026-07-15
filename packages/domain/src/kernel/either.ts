// ─────────────────────────────────────────────────────────────────────────────
// Either<L, R> — bifunctor genérico (esquerda = L, direita = R).
// Distinto de Result: Either não impõe semântica de sucesso/erro.
// Puro. Nenhuma dependência de tecnologia.
// ─────────────────────────────────────────────────────────────────────────────

export class Either<L, R> {
  private constructor(
    private readonly _isRight: boolean,
    private readonly _left?: L,
    private readonly _right?: R,
  ) {
    Object.freeze(this);
  }

  static left<L, R>(value: L): Either<L, R> {
    return new Either<L, R>(false, value, undefined);
  }

  static right<L, R>(value: R): Either<L, R> {
    return new Either<L, R>(true, undefined, value);
  }

  isLeft(): boolean {
    return !this._isRight;
  }

  isRight(): boolean {
    return this._isRight;
  }

  fold<T>(onLeft: (left: L) => T, onRight: (right: R) => T): T {
    return this._isRight ? onRight(this._right as R) : onLeft(this._left as L);
  }

  map<T>(fn: (right: R) => T): Either<L, T> {
    return this._isRight
      ? Either.right<L, T>(fn(this._right as R))
      : Either.left<L, T>(this._left as L);
  }

  mapLeft<T>(fn: (left: L) => T): Either<T, R> {
    return this._isRight
      ? Either.right<T, R>(this._right as R)
      : Either.left<T, R>(fn(this._left as L));
  }
}
