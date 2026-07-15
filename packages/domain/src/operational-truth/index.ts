// ─────────────────────────────────────────────────────────────────────────────
// Entidade 07 — VERDADE OPERACIONAL (barrel). Sprint 1G (Núcleo Cognitivo).
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
// ─────────────────────────────────────────────────────────────────────────────
export { OperationalTruthId } from './operational-truth-id.js';
export { OperationalTruthAggregate } from './operational-truth.js';
export type { OperationalTruthSynthesisInput } from './operational-truth.js';
export { OperationalTruthMissionRef, SynthesisResponsibleRef } from './refs.js';
export { ChainJustification, DeclaredUncertainty } from './value-objects.js';
export { OperationalTruthSynthesized } from './operational-truth-events.js';
export {
  operationalTruthEntityInvariants,
  OPERATIONAL_TRUTH_INVARIANTS_MANIFEST,
} from './operational-truth-invariants.js';
export type { OperationalTruthInvariantSpec } from './operational-truth-invariants.js';
