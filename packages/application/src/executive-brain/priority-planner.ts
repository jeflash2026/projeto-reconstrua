// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY PLANNER — ordena as regras aplicáveis por PRIORIDADE (maior primeiro),
// com desempate estável por `ref` (ordem alfabética) → determinístico e reprodutível.
// ─────────────────────────────────────────────────────────────────────────────
import type { OperationalRuleSpec } from './rule.js';

export class PriorityPlanner {
  order(rules: readonly OperationalRuleSpec[]): readonly OperationalRuleSpec[] {
    return [...rules].sort((a, b) => b.priority - a.priority || a.ref.localeCompare(b.ref));
  }
}
