// ─────────────────────────────────────────────────────────────────────────────
// Entidade 11 — OPERAÇÃO (barrel). Sprint 1K.
// (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO no índice
// do domínio.)
//
// Nota: a OPERAÇÃO não possui Value Object escalar próprio. O Canon (item 14) lista
// naturezas e relações (conjunto de ações; regida pelo Volume 03; auditável), não
// um valor escalar. Os "Value Objects mínimos" são as referências imutáveis
// (refs.ts); criar um VO textual seria invenção fora do Canon.
// ─────────────────────────────────────────────────────────────────────────────
export { OperationId } from './operation-id.js';
export { OperationAggregate } from './operation.js';
export type { OperationConductInput } from './operation.js';
export { OperationMissionRef, OperationResponsibleRef } from './refs.js';
export { OperationConducted } from './operation-events.js';
export {
  operationEntityInvariants,
  OPERATION_INVARIANTS_MANIFEST,
} from './operation-invariants.js';
export type { OperationInvariantSpec } from './operation-invariants.js';
