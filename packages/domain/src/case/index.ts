// ─────────────────────────────────────────────────────────────────────────────
// Entidade 05 — CASO (barrel). Sprint 1E.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
// ─────────────────────────────────────────────────────────────────────────────
export { CaseId } from './case-id.js';
export { CaseAggregate } from './case.js';
export type { CaseRecognitionInput } from './case.js';
export { CaseMissionRef, CaseResponsibleRef } from './refs.js';
export { LegalContext, LegalFoundation } from './value-objects.js';
export { CaseRecognized } from './case-events.js';
export { caseEntityInvariants, CASE_INVARIANTS_MANIFEST } from './case-invariants.js';
export type { CaseInvariantSpec } from './case-invariants.js';
