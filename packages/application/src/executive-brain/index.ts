// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/application — Executive Brain Runtime (Sprint 2C).
// Camada 2 (decisão) da ADR-0002A: determinístico, sem LLM, RO-gated, auditável.
// Produz as seis intenções; consumido pela Conversa (2B) via adapter na infra.
// ─────────────────────────────────────────────────────────────────────────────
export * from './provenance.js';
export * from './mission-snapshot.js';
export * from './conditions.js';
export * from './facts.js';
export * from './rule.js';
export * from './intents.js';
export * from './ports.js';
export * from './brain-context.js';
export * from './planning.js';
export * from './goal-selector.js';
export * from './rule-evaluator.js';
export * from './priority-planner.js';
export * from './strategy-planner.js';
export * from './legitimacy-gate.js';
export * from './human-decision-gate.js';
export * from './escalation-planner.js';
export * from './next-best-action-planner.js';
export * from './execution-planner.js';
export * from './intent-emitter.js';
export * from './audit.js';
export * from './executive-brain-runtime.js';
