// ─────────────────────────────────────────────────────────────────────────────
// PLANNING — tipos compartilhados do planejamento. Uma AÇÃO ESCOLHIDA é sempre um
// invólucro de uma REGRA (nunca há decisão sem regra — spec 2C). O plano de
// execução separa a ação PRIMÁRIA (falar/esperar/parar/escalar) das ações de
// APOIO (casos de uso e notificações que acompanham o turno).
// ─────────────────────────────────────────────────────────────────────────────
import type { OperationalRuleSpec } from './rule.js';

/** Uma ação escolhida = a regra que a origina (a ação é `rule.action`). */
export interface ChosenAction {
  readonly rule: OperationalRuleSpec;
}

export interface ExecutionPlan {
  /** Ação principal do turno (conversa/wait/stop/escalação) — pode faltar. */
  readonly primary: ChosenAction | null;
  /** Ações de apoio (use_case/notification) que acompanham o turno. */
  readonly supporting: readonly ChosenAction[];
}
