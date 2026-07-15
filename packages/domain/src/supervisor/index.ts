// ─────────────────────────────────────────────────────────────────────────────
// Entidade 18 — SUPERVISOR (barrel). Sprint 1R.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
//
// Nota: o SUPERVISOR não possui Value Object escalar próprio. O Canon (item 14)
// lista naturezas (papel humano; supervisão; temporário), não um valor escalar; os
// critérios de supervisão são remetidos à Governança (INV-SU-03; DF-12). Os "Value
// Objects mínimos" são as referências imutáveis (refs.ts); criar um VO textual
// seria invenção fora do Canon.
// ─────────────────────────────────────────────────────────────────────────────
export { SupervisorId } from './supervisor-id.js';
export { SupervisorAggregate } from './supervisor.js';
export type { SupervisorDesignationInput } from './supervisor.js';
export { SupervisorPersonRef, SupervisorMissionRef, SupervisorAuthorityRef } from './refs.js';
export { SupervisorDesignated } from './supervisor-events.js';
export {
  supervisorEntityInvariants,
  SUPERVISOR_INVARIANTS_MANIFEST,
} from './supervisor-invariants.js';
export type { SupervisorInvariantSpec } from './supervisor-invariants.js';
