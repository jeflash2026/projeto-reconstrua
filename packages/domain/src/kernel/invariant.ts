// ─────────────────────────────────────────────────────────────────────────────
// Invariant<T> — representação de UMA invariante do Livro Mestre como código.
// Cada invariante liga-se explicitamente à sua referência normativa (canonReference)
// e ao seu identificador oficial (id, ex.: 'INV-02'). Puro.
//
// Este arquivo NÃO define nenhuma invariante concreta (isso é conteúdo de domínio,
// que virá em sprint futura). Define apenas a forma de uma invariante.
// ─────────────────────────────────────────────────────────────────────────────
import type { Specification } from './specification.js';

export interface Invariant<T> {
  /** Identificador oficial no Livro Mestre (ex.: 'INV-D09'). */
  readonly id: string;
  /** Referência normativa (ex.: 'Entidade 03 — DOCUMENTO; DF-05'). */
  readonly canonReference: string;
  /** Descrição legível da invariante. */
  readonly description: string;
  /** Verdadeiro quando o alvo SATISFAZ a invariante. */
  isSatisfiedBy(target: T): boolean;
}

/** Cria uma invariante a partir de uma Specification. */
export function invariantFromSpec<T>(params: {
  id: string;
  canonReference: string;
  description: string;
  specification: Specification<T>;
}): Invariant<T> {
  return {
    id: params.id,
    canonReference: params.canonReference,
    description: params.description,
    isSatisfiedBy: (target: T): boolean => params.specification.isSatisfiedBy(target),
  };
}

/** Cria uma invariante a partir de um predicado simples. */
export function defineInvariant<T>(params: {
  id: string;
  canonReference: string;
  description: string;
  check: (target: T) => boolean;
}): Invariant<T> {
  return {
    id: params.id,
    canonReference: params.canonReference,
    description: params.description,
    isSatisfiedBy: params.check,
  };
}
