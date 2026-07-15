// ─────────────────────────────────────────────────────────────────────────────
// Entidade 12 — REGRA OPERACIONAL (barrel). Sprint 1L.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
// ─────────────────────────────────────────────────────────────────────────────
export { OperationalRuleId } from './operational-rule-id.js';
export { OperationalRuleAggregate } from './operational-rule.js';
export type { OperationalRuleApprovalInput } from './operational-rule.js';
export { ApprovalResponsibleRef } from './refs.js';
export { RuleCode, RuleDefinition, RuleVersion, CanonFoundation } from './value-objects.js';
export type { RuleDefinitionFields } from './value-objects.js';
export { OperationalRuleApproved } from './operational-rule-events.js';
export {
  operationalRuleEntityInvariants,
  OPERATIONAL_RULE_INVARIANTS_MANIFEST,
} from './operational-rule-invariants.js';
export type { OperationalRuleInvariantSpec } from './operational-rule-invariants.js';
