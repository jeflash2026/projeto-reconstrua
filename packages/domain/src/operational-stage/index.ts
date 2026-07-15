// ─────────────────────────────────────────────────────────────────────────────
// Entidade 09 — ETAPA OPERACIONAL (barrel). Sprint 1I (encerra o Núcleo Cognitivo).
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
// ─────────────────────────────────────────────────────────────────────────────
export { OperationalStageId } from './operational-stage-id.js';
export { OperationalStageAggregate } from './operational-stage.js';
export type { OperationalStageRepresentationInput } from './operational-stage.js';
export { RepresentedStateRef } from './refs.js';
export { StageForm } from './value-objects.js';
export { OperationalStageRepresented } from './operational-stage-events.js';
export {
  operationalStageEntityInvariants,
  OPERATIONAL_STAGE_INVARIANTS_MANIFEST,
} from './operational-stage-invariants.js';
export type { OperationalStageInvariantSpec } from './operational-stage-invariants.js';
