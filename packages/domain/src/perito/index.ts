// ─────────────────────────────────────────────────────────────────────────────
// Entidade 16 — PERITO (barrel). Sprint 1P.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
//
// Nota: o PERITO não possui Value Object escalar próprio. O Canon (item 14) lista
// naturezas/relações (papel humano; responsabilidade técnica regulamentada), não
// um valor escalar. Os "Value Objects mínimos" são as referências imutáveis
// (refs.ts); criar um VO textual seria invenção fora do Canon.
// ─────────────────────────────────────────────────────────────────────────────
export { PeritoId } from './perito-id.js';
export { PeritoAggregate } from './perito.js';
export type { PeritoDesignationInput } from './perito.js';
export {
  PeritoPersonRef,
  PeritoMissionRef,
  PeritoExpertiseRef,
  PeritoAuthorityRef,
} from './refs.js';
export { PeritoDesignated } from './perito-events.js';
export { peritoEntityInvariants, PERITO_INVARIANTS_MANIFEST } from './perito-invariants.js';
export type { PeritoInvariantSpec } from './perito-invariants.js';
