// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY PLANNER — do objetivo + fatos, escolhe a ESTRATÉGIA do turno e as
// naturezas de ação PREFERIDAS por ela. A estratégia desempata o Next-Best-Action
// (ex.: 'escalate' prefere escalação; 'await' prefere esperar). Determinístico.
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainFacts } from './facts.js';
import type { Goal } from './mission-snapshot.js';
import type { RuleActionKind } from './rule.js';

export type Strategy = 'escalate' | 'advance' | 'stabilize' | 'await';

export interface StrategyDecision {
  readonly strategy: Strategy;
  /** Naturezas de ação preferidas (para desempate no NBA). Ordem = preferência. */
  readonly preferredKinds: readonly RuleActionKind[];
}

export class StrategyPlanner {
  plan(goal: Goal, facts: BrainFacts): StrategyDecision {
    if (goal === 'escalate_to_human') {
      return { strategy: 'escalate', preferredKinds: ['escalation', 'notification'] };
    }
    if (facts['isSilence'] === true) {
      return { strategy: 'await', preferredKinds: ['conversation', 'wait'] };
    }
    if (goal === 'monitor_deadline' || goal === 'collect_documents' || goal === 'advance_stage') {
      return { strategy: 'advance', preferredKinds: ['use_case', 'conversation', 'notification'] };
    }
    return { strategy: 'stabilize', preferredKinds: ['conversation', 'wait'] };
  }
}
