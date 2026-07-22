// ─────────────────────────────────────────────────────────────────────────────
// RULE EVALUATOR — avalia CADA regra do catálogo contra os fatos. Registra o
// resultado por regra (casou? bloqueou? qual bloqueio?) para AUDITORIA. Uma regra
// é APLICÁVEL quando TODAS as pré-condições são verdadeiras e NENHUM bloqueio é.
// Determinístico e total.
// ─────────────────────────────────────────────────────────────────────────────
import { evaluateCondition } from './conditions.js';
import type { BrainFacts } from './facts.js';
import type { OperationalRuleSpec } from './rule.js';

export interface RuleEvaluation {
  readonly ref: string;
  readonly priority: number;
  readonly matched: boolean; // todas as pré-condições verdadeiras
  readonly blockedByIndex: number; // índice do 1º bloqueio disparado, ou -1
  readonly applicable: boolean; // matched && sem bloqueio
}

export class RuleEvaluator {
  evaluate(rule: OperationalRuleSpec, facts: BrainFacts): RuleEvaluation {
    const matched = rule.preconditions.every((c) => evaluateCondition(c, facts));
    let blockedByIndex = -1;
    for (let i = 0; i < rule.blocks.length; i += 1) {
      const block = rule.blocks[i];
      if (block && evaluateCondition(block, facts)) {
        blockedByIndex = i;
        break;
      }
    }
    return {
      ref: rule.ref,
      priority: rule.priority,
      matched,
      blockedByIndex,
      applicable: matched && blockedByIndex === -1,
    };
  }

  evaluateAll(rules: readonly OperationalRuleSpec[], facts: BrainFacts): readonly RuleEvaluation[] {
    return rules.map((rule) => this.evaluate(rule, facts));
  }
}
