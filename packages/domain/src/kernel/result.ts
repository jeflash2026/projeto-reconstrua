// ─────────────────────────────────────────────────────────────────────────────
// Result<T, E> — sucesso ou falha explícita, sem exceções de fluxo.
// Puro. Nenhuma dependência de tecnologia.
// ─────────────────────────────────────────────────────────────────────────────
import type { DomainError } from './errors/domain-error.js';

export class Result<T, E = DomainError> {
  private constructor(
    private readonly _ok: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {
    Object.freeze(this);
  }

  static ok<T, E = DomainError>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static err<T, E = DomainError>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  isOk(): boolean {
    return this._ok;
  }

  isErr(): boolean {
    return !this._ok;
  }

  /** Retorna o valor ou lança se for erro. Uso restrito a bordas já validadas. */
  unwrap(): T {
    if (!this._ok) {
      throw new Error('Result.unwrap() chamado sobre um erro.');
    }
    return this._value as T;
  }

  unwrapErr(): E {
    if (this._ok) {
      throw new Error('Result.unwrapErr() chamado sobre um sucesso.');
    }
    return this._error as E;
  }

  getOrElse(fallback: T): T {
    return this._ok ? (this._value as T) : fallback;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return this._ok ? Result.ok<U, E>(fn(this._value as T)) : Result.err<U, E>(this._error as E);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return this._ok ? Result.ok<T, F>(this._value as T) : Result.err<T, F>(fn(this._error as E));
  }

  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this._ok ? fn(this._value as T) : Result.err<U, E>(this._error as E);
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return this._ok ? handlers.ok(this._value as T) : handlers.err(this._error as E);
  }
}
