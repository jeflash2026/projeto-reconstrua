// ─────────────────────────────────────────────────────────────────────────────
// CONDITIONS — o modelo DECLARATIVO e AUDITÁVEL de pré-condições e bloqueios das
// Regras Operacionais. Condições são DADOS (não closures opacas): serializáveis,
// inspecionáveis e determinísticas. Avaliadas contra os FATOS achatados (BrainFacts).
//
// Isto torna cada decisão rastreável: dá para dizer exatamente QUAL condição
// disparou (ou bloqueou) uma regra.
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainFacts, FactValue } from './facts.js';

export type ComparableOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export type Condition =
  | { readonly fact: string; readonly op: ComparableOp; readonly value: string | number | boolean }
  | { readonly fact: string; readonly op: 'in'; readonly value: readonly string[] }
  | { readonly fact: string; readonly op: 'contains'; readonly value: string }
  | { readonly fact: string; readonly op: 'truthy' }
  | { readonly fact: string; readonly op: 'falsy' }
  | { readonly all: readonly Condition[] }
  | { readonly any: readonly Condition[] }
  | { readonly not: Condition };

function asNumber(value: FactValue): number | null {
  return typeof value === 'number' ? value : null;
}

function compareNumbers(op: ComparableOp, a: number, b: number): boolean {
  switch (op) {
    case 'eq':
      return a === b;
    case 'neq':
      return a !== b;
    case 'gt':
      return a > b;
    case 'gte':
      return a >= b;
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
  }
}

/** Avalia uma condição contra os fatos. Determinística e total (nunca lança). */
export function evaluateCondition(condition: Condition, facts: BrainFacts): boolean {
  if ('all' in condition) {
    return condition.all.every((c) => evaluateCondition(c, facts));
  }
  if ('any' in condition) {
    return condition.any.some((c) => evaluateCondition(c, facts));
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, facts);
  }

  const actual = facts[condition.fact] ?? null;

  switch (condition.op) {
    case 'truthy':
      return actual === true || (typeof actual === 'number' && actual !== 0) || (typeof actual === 'string' && actual !== '');
    case 'falsy':
      return actual === false || actual === null || actual === 0 || actual === '';
    case 'in':
      return typeof actual === 'string' && condition.value.includes(actual);
    case 'contains':
      return Array.isArray(actual) && actual.includes(condition.value);
    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const target = condition.value;
      if (typeof target === 'number') {
        const n = asNumber(actual);
        return n === null ? false : compareNumbers(condition.op, n, target);
      }
      // Igualdade estrita para string/boolean (só eq/neq fazem sentido).
      if (condition.op === 'eq') return actual === target;
      if (condition.op === 'neq') return actual !== target;
      return false;
    }
  }
}
