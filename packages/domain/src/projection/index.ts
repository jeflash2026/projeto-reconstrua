// ─────────────────────────────────────────────────────────────────────────────
// Entidade 10 — PROJEÇÃO (barrel). Sprint 1J.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
// ─────────────────────────────────────────────────────────────────────────────
export { ProjectionId } from './projection-id.js';
export { ProjectionAggregate } from './projection.js';
export type { ProjectionDerivationInput } from './projection.js';
export { ProjectionTruthRef } from './refs.js';
export { DerivedReading } from './value-objects.js';
export { ProjectionDerived } from './projection-events.js';
export {
  projectionEntityInvariants,
  PROJECTION_INVARIANTS_MANIFEST,
} from './projection-invariants.js';
export type { ProjectionInvariantSpec } from './projection-invariants.js';
