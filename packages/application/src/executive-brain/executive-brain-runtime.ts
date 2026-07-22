// ─────────────────────────────────────────────────────────────────────────────
// EXECUTIVE BRAIN RUNTIME — o cérebro operacional da AHRI. 100% DETERMINÍSTICO,
// SEM LLM. Orquestra: GoalSelector → RuleEvaluator → Priority/Strategy → Legitimacy
// Gate → NextBestAction/Execution → (Escalation/HumanDecision) → IntentEmitter →
// Auditoria.
//
// Produz EXCLUSIVAMENTE as seis intenções (Conversation/UseCase/Escalation/Wait/
// Stop/Notification), cada uma com DECISOR/TIPO/FUNDAMENTO/REGRA. NENHUMA decisão
// existe sem regra: se o catálogo não tiver a regra-meta obrigatória (escalação/
// espera), o Brain FALHA FECHADO. Nunca gera texto, nunca lê o Event Store, nunca
// muta Verdade/Estado/Etapa.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { BrainContext } from './brain-context.js';
import { buildFacts, withGoal } from './facts.js';
import { GoalSelector } from './goal-selector.js';
import { RuleEvaluator } from './rule-evaluator.js';
import { PriorityPlanner } from './priority-planner.js';
import { StrategyPlanner } from './strategy-planner.js';
import { LegitimacyGate } from './legitimacy-gate.js';
import { HumanDecisionGate } from './human-decision-gate.js';
import { EscalationPlanner } from './escalation-planner.js';
import { NextBestActionPlanner } from './next-best-action-planner.js';
import { ExecutionPlanner } from './execution-planner.js';
import { IntentEmitter } from './intent-emitter.js';
import type { BrainIntent } from './intents.js';
import type { ChosenAction } from './planning.js';
import type { OperationalRuleSpec } from './rule.js';
import type { BrainAuditSink, BrainDecisionRecord, ImpededRecord } from './audit.js';

/** Falha fechada: o catálogo não oferece uma regra-meta obrigatória. */
export class BrainCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrainCatalogError';
  }
}

export interface BrainOutcome {
  readonly intents: readonly BrainIntent[];
  readonly record: BrainDecisionRecord;
}

export interface ExecutiveBrainDeps {
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly auditSink?: BrainAuditSink;
}

export class ExecutiveBrainRuntime {
  private readonly goalSelector = new GoalSelector();
  private readonly evaluator = new RuleEvaluator();
  private readonly priorityPlanner = new PriorityPlanner();
  private readonly strategyPlanner = new StrategyPlanner();
  private readonly legitimacyGate = new LegitimacyGate();
  private readonly humanGate = new HumanDecisionGate();
  private readonly escalationPlanner = new EscalationPlanner();
  private readonly nbaPlanner = new NextBestActionPlanner();
  private readonly executionPlanner = new ExecutionPlanner();
  private readonly emitter: IntentEmitter;

  private readonly clock: Clock;
  private readonly uuid: UuidGenerator;
  private readonly auditSink: BrainAuditSink | undefined;

  constructor(deps: ExecutiveBrainDeps) {
    this.clock = deps.clock;
    this.uuid = deps.uuid;
    this.auditSink = deps.auditSink;
    this.emitter = new IntentEmitter(deps.clock, deps.uuid);
  }

  async decide(context: BrainContext): Promise<BrainOutcome> {
    const missionId = context.snapshot.missionId;

    // 1) Objetivo, fatos, estratégia, e quem decide (humano?).
    const goal = this.goalSelector.select(context.snapshot);
    const facts = withGoal(buildFacts(context.percept, context.snapshot, context.memory), goal);
    const strategy = this.strategyPlanner.plan(goal, facts);
    const human = this.humanGate.assess(facts);

    // 2) Avalia todas as regras; separa aplicáveis.
    const evaluations = this.evaluator.evaluateAll(context.rules, facts);
    const applicableRefs = new Set(evaluations.filter((e) => e.applicable).map((e) => e.ref));
    const applicable = context.rules.filter((r) => applicableRefs.has(r.ref));
    const ordered = this.priorityPlanner.order(applicable);

    // 3) Portão de legitimidade (RO-R7-001): legítimas x impedidas.
    const legitimate: OperationalRuleSpec[] = [];
    const impeded: ImpededRecord[] = [];
    for (const rule of ordered) {
      const verdict = this.legitimacyGate.check(rule, facts);
      if (verdict.legitimate) legitimate.push(rule);
      else impeded.push({ ref: rule.ref, cause: verdict.cause ?? 'desconhecida' });
    }

    // 4) Escolha das ações — SEMPRE a partir de regra.
    const chosen = human.requiresHuman
      ? [
          this.requireRule(
            this.escalationPlanner.planFor(context.rules, human.role) ??
              this.fallback(context.rules),
          ),
        ]
      : this.chooseOperational(legitimate, strategy, goal, human.role, context.rules);

    // 5) Emite intenções e audita.
    const intents = chosen.map((c) => this.emitter.emit(c, missionId, context.chatId));
    const record: BrainDecisionRecord = {
      id: this.uuid.next(),
      missionId,
      chatId: context.chatId,
      at: this.clock.now(),
      goal,
      strategy: strategy.strategy,
      facts,
      evaluations,
      chosenRefs: chosen.map((c) => c.rule.ref),
      emitted: intents.map((i) => ({ kind: i.kind, provenance: i.provenance })),
      impeded,
      humanRequired: human.requiresHuman,
    };
    if (this.auditSink) await this.auditSink.record(record);

    return { intents, record };
  }

  private chooseOperational(
    legitimate: readonly OperationalRuleSpec[],
    strategy: ReturnType<StrategyPlanner['plan']>,
    goal: string,
    role: Parameters<EscalationPlanner['planFor']>[1],
    rules: readonly OperationalRuleSpec[],
  ): readonly ChosenAction[] {
    const primary = this.nbaPlanner.pick(legitimate, strategy);
    const plan = this.executionPlanner.plan(legitimate, primary);
    const chosen: ChosenAction[] = [];
    if (plan.primary) chosen.push(plan.primary);
    chosen.push(...plan.supporting);
    if (chosen.length > 0) return chosen;

    // Nada aplicável/legítimo → escalar (se o objetivo é escalar) ou esperar.
    const fallback =
      goal === 'escalate_to_human'
        ? this.escalationPlanner.planFor(rules, role)
        : this.fallback(rules);
    return [this.requireRule(fallback ?? this.fallback(rules))];
  }

  private fallback(rules: readonly OperationalRuleSpec[]): ChosenAction | null {
    return this.escalationPlanner.fallbackWait(rules);
  }

  private requireRule(chosen: ChosenAction | null): ChosenAction {
    if (!chosen) {
      throw new BrainCatalogError(
        'catálogo sem regra-meta obrigatória (escalação/espera): nenhuma decisão pode existir sem regra',
      );
    }
    return chosen;
  }
}
