// ─────────────────────────────────────────────────────────────────────────────
// ESCALATION PLANNER — quando é preciso escalar (matéria humana / Canon silente /
// nenhuma ação legítima), escolhe a REGRA de escalação do catálogo para o papel
// devido. Também provê o WAIT default (fallback). Nunca fabrica decisão sem regra:
// se o catálogo não tiver a regra necessária, devolve null (o runtime falha fechado).
// ─────────────────────────────────────────────────────────────────────────────
import type { HumanRole } from './mission-snapshot.js';
import type { ChosenAction } from './planning.js';
import type { OperationalRuleSpec } from './rule.js';

export class EscalationPlanner {
  /** Regra de escalação para o papel (ou a primeira de escalação disponível). */
  planFor(rules: readonly OperationalRuleSpec[], role: HumanRole): ChosenAction | null {
    const forRole = rules.find((r) => r.action.kind === 'escalation' && r.action.role === role);
    if (forRole) return { rule: forRole };
    const anyEscalation = rules.find((r) => r.action.kind === 'escalation');
    return anyEscalation ? { rule: anyEscalation } : null;
  }

  /** Regra de espera default (fallback quando nada mais se aplica). */
  fallbackWait(rules: readonly OperationalRuleSpec[]): ChosenAction | null {
    const wait = rules.find((r) => r.action.kind === 'wait');
    return wait ? { rule: wait } : null;
  }
}
