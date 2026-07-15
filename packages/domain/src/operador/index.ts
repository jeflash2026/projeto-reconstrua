// ─────────────────────────────────────────────────────────────────────────────
// Entidade 15 — OPERADOR (barrel). Sprint 1O.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
//
// Nota: o OPERADOR não possui Value Object escalar próprio. O Canon (item 14) lista
// naturezas/relações (papel humano; responsabilidade temporária; condução diária),
// não um valor escalar. Os "Value Objects mínimos" são as referências imutáveis
// (refs.ts); criar um VO textual seria invenção fora do Canon.
// ─────────────────────────────────────────────────────────────────────────────
export { OperadorId } from './operador-id.js';
export { OperadorAggregate } from './operador.js';
export type { OperadorDesignationInput } from './operador.js';
export { OperadorPersonRef, OperadorMissionRef, OperadorAuthorityRef } from './refs.js';
export { OperadorDesignated } from './operador-events.js';
export { operadorEntityInvariants, OPERADOR_INVARIANTS_MANIFEST } from './operador-invariants.js';
export type { OperadorInvariantSpec } from './operador-invariants.js';
