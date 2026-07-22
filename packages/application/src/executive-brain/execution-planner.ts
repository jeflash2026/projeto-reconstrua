// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION PLANNER — monta o PLANO do turno: a ação primária (do NBA) + as ações
// de APOIO (use_case/notification legítimas e aplicáveis que acompanham). Assim, num
// mesmo turno, o Brain pode invocar um caso de uso, notificar um humano e falar —
// tudo com regra própria. Determinístico; sem duplicar a primária.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChosenAction, ExecutionPlan } from './planning.js';
import type { OperationalRuleSpec } from './rule.js';

const SUPPORTING_KINDS = new Set(['use_case', 'notification']);

export class ExecutionPlanner {
  plan(
    orderedLegitimate: readonly OperationalRuleSpec[],
    primary: ChosenAction | null,
  ): ExecutionPlan {
    const primaryRef = primary?.rule.ref ?? null;
    const supporting: ChosenAction[] = orderedLegitimate
      .filter((r) => SUPPORTING_KINDS.has(r.action.kind) && r.ref !== primaryRef)
      .map((r) => ({ rule: r }));
    return { primary, supporting };
  }
}
