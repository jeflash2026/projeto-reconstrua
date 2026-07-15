// ─────────────────────────────────────────────────────────────────────────────
// Testes do RuleEvaluator — casou (todas as pré-condições), bloqueou (qualquer
// bloqueio), aplicável (casou e sem bloqueio), com rastro por regra.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { RuleEvaluator } from './rule-evaluator.js';
import type { BrainFacts } from './facts.js';
import type { OperationalRuleSpec } from './rule.js';

const ev = new RuleEvaluator();

function rule(over: Partial<OperationalRuleSpec>): OperationalRuleSpec {
  return {
    ref: 'RO-A',
    title: 't',
    priority: 10,
    preconditions: [],
    blocks: [],
    action: { kind: 'wait', reasonCode: 'X', untilHintMs: null },
    fundamento: 'F',
    ...over,
  };
}

const facts: BrainFacts = { perceptKind: 'text', hasPendingDocuments: true, matterRequiresHuman: false };

describe('RuleEvaluator', () => {
  it('aplicável quando casa e não bloqueia', () => {
    const r = rule({ preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'text' }] });
    const e = ev.evaluate(r, facts);
    expect(e).toMatchObject({ matched: true, blockedByIndex: -1, applicable: true });
  });

  it('não casa quando alguma pré-condição falha', () => {
    const r = rule({ preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'audio' }] });
    expect(ev.evaluate(r, facts).applicable).toBe(false);
  });

  it('bloqueia quando um bloqueio dispara (registra o índice)', () => {
    const r = rule({
      preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'text' }],
      blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }, { fact: 'hasPendingDocuments', op: 'truthy' }],
    });
    const e = ev.evaluate(r, facts);
    expect(e.matched).toBe(true);
    expect(e.blockedByIndex).toBe(1);
    expect(e.applicable).toBe(false);
  });
});
