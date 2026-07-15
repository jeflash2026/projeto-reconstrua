// ─────────────────────────────────────────────────────────────────────────────
// NEXT-BEST-ACTION PLANNER — escolhe a ÚNICA ação PRIMÁRIA do turno entre as
// candidatas legítimas ordenadas (conversa/wait/stop/escalação). Prioridade manda;
// no empate de prioridade máxima, a ESTRATÉGIA desempata pela natureza preferida.
// Determinístico. Não emite nada — só escolhe.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChosenAction } from './planning.js';
import type { OperationalRuleSpec, RuleActionKind } from './rule.js';
import type { StrategyDecision } from './strategy-planner.js';

const PRIMARY_KINDS: readonly RuleActionKind[] = ['conversation', 'wait', 'stop', 'escalation'];

export class NextBestActionPlanner {
  pick(
    orderedLegitimate: readonly OperationalRuleSpec[],
    strategy: StrategyDecision,
  ): ChosenAction | null {
    const primaryCandidates = orderedLegitimate.filter((r) => PRIMARY_KINDS.includes(r.action.kind));
    const first = primaryCandidates[0];
    if (!first) return null;

    const topTier = primaryCandidates.filter((r) => r.priority === first.priority);
    for (const kind of strategy.preferredKinds) {
      const match = topTier.find((r) => r.action.kind === kind);
      if (match) return { rule: match };
    }
    return { rule: first };
  }
}
