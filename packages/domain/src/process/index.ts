// ─────────────────────────────────────────────────────────────────────────────
// Entidade 06 — PROCESSO (barrel). Sprint 1F.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
// ─────────────────────────────────────────────────────────────────────────────
export { ProcessId } from './process-id.js';
export { ProcessAggregate } from './process.js';
export type { ProcessRecognitionInput } from './process.js';
export { ProcessMissionRef, ProcessCaseRef, ProcessResponsibleRef } from './refs.js';
export { ProcessLegalFoundation } from './value-objects.js';
export { ProcessRecognized } from './process-events.js';
export { processEntityInvariants, PROCESS_INVARIANTS_MANIFEST } from './process-invariants.js';
export type { ProcessInvariantSpec } from './process-invariants.js';
