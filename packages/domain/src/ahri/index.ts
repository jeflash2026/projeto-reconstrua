// ─────────────────────────────────────────────────────────────────────────────
// Entidade 14 — AHRI (barrel). Sprint 1N (abre o Bloco de Papéis).
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
// ─────────────────────────────────────────────────────────────────────────────
export { AhriId } from './ahri-id.js';
export { AhriAggregate } from './ahri.js';
export type { AhriResponsibilityInput } from './ahri.js';
export { AhriMissionRef, GoverningRuleRef } from './refs.js';
export { AutomatedDecisionRecord, AHRI_DECISOR, AHRI_DECISION_TYPE } from './value-objects.js';
export { AhriOperationalResponsibilityAssumed } from './ahri-events.js';
export { ahriEntityInvariants, AHRI_INVARIANTS_MANIFEST } from './ahri-invariants.js';
export type { AhriInvariantSpec } from './ahri-invariants.js';
