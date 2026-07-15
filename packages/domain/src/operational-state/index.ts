// ─────────────────────────────────────────────────────────────────────────────
// Entidade 08 — ESTADO OPERACIONAL (barrel). Sprint 1H (Núcleo Cognitivo).
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
// ─────────────────────────────────────────────────────────────────────────────
export { OperationalStateId } from './operational-state-id.js';
export { OperationalStateAggregate } from './operational-state.js';
export type { OperationalStateDerivationInput } from './operational-state.js';
export { OperationalStateMissionRef, DerivedFromTruthRef } from './refs.js';
export { TerminalState } from './value-objects.js';
export type { TerminalStateValue } from './value-objects.js';
export { OperationalStateDerived } from './operational-state-events.js';
export {
  operationalStateEntityInvariants,
  OPERATIONAL_STATE_INVARIANTS_MANIFEST,
} from './operational-state-invariants.js';
export type { OperationalStateInvariantSpec } from './operational-state-invariants.js';
