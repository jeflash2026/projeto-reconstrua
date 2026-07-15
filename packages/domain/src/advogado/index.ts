// ─────────────────────────────────────────────────────────────────────────────
// Entidade 17 — ADVOGADO (barrel). Sprint 1Q.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
//
// Nota: o ADVOGADO não possui Value Object escalar próprio. O Canon (item 14) lista
// naturezas/relações (papel humano; competência jurídica privativa; responsabilidade
// profissional), não um valor escalar. Os "Value Objects mínimos" são as
// referências imutáveis (refs.ts); criar um VO textual seria invenção fora do Canon.
// ─────────────────────────────────────────────────────────────────────────────
export { AdvogadoId } from './advogado-id.js';
export { AdvogadoAggregate } from './advogado.js';
export type { AdvogadoDesignationInput } from './advogado.js';
export { AdvogadoPersonRef, AdvogadoMissionRef, AdvogadoAuthorityRef } from './refs.js';
export { AdvogadoDesignated } from './advogado-events.js';
export { advogadoEntityInvariants, ADVOGADO_INVARIANTS_MANIFEST } from './advogado-invariants.js';
export type { AdvogadoInvariantSpec } from './advogado-invariants.js';
