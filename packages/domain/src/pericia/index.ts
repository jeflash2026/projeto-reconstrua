// ─────────────────────────────────────────────────────────────────────────────
// Entidade 13 — PERÍCIA (barrel). Sprint 1M.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
//
// Nota: a PERÍCIA não possui Value Object escalar próprio. O Canon (item 14) lista
// naturezas/relações (especialização de etapa; produção técnica de prova — do
// Perito), não um valor escalar. Os "Value Objects mínimos" são as referências
// imutáveis (refs.ts); criar um VO textual seria invenção fora do Canon.
// ─────────────────────────────────────────────────────────────────────────────
export { PericiaId } from './pericia-id.js';
export { PericiaAggregate } from './pericia.js';
export type { PericiaFramingInput } from './pericia.js';
export { PericiaMissionRef, SpecializedStageRef, PericiaPeritoRef } from './refs.js';
export { PericiaFramed } from './pericia-events.js';
export { periciaEntityInvariants, PERICIA_INVARIANTS_MANIFEST } from './pericia-invariants.js';
export type { PericiaInvariantSpec } from './pericia-invariants.js';
