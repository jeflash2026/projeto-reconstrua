// ─────────────────────────────────────────────────────────────────────────────
// AUDIT — o registro RASTREÁVEL de cada decisão do Brain. Guarda o objetivo, a
// estratégia, os FATOS avaliados, o resultado POR REGRA (casou/bloqueou), as ações
// escolhidas, as intenções emitidas (com proveniência) e as ações IMPEDIDAS (com
// causa). Com isto, qualquer decisão é reconstituível e explicável.
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainFacts } from './facts.js';
import type { Goal } from './mission-snapshot.js';
import type { RuleEvaluation } from './rule-evaluator.js';
import type { Strategy } from './strategy-planner.js';
import type { DecisionProvenance } from './provenance.js';
import type { BrainIntentKind } from './intents.js';

export interface EmittedSummary {
  readonly kind: BrainIntentKind;
  readonly provenance: DecisionProvenance;
}

export interface ImpededRecord {
  readonly ref: string;
  readonly cause: string;
}

export interface BrainDecisionRecord {
  readonly id: string;
  readonly missionId: string;
  readonly chatId: string | null;
  readonly at: Date;
  readonly goal: Goal;
  readonly strategy: Strategy;
  readonly facts: BrainFacts;
  readonly evaluations: readonly RuleEvaluation[];
  readonly chosenRefs: readonly string[];
  readonly emitted: readonly EmittedSummary[];
  readonly impeded: readonly ImpededRecord[];
  readonly humanRequired: boolean;
}

/** Sink de auditoria (adapter na infra: memória, warehouse append-only, …). */
export interface BrainAuditSink {
  record(decision: BrainDecisionRecord): Promise<void>;
}
