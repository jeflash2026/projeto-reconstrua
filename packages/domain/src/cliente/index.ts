// ─────────────────────────────────────────────────────────────────────────────
// Entidade 19 — CLIENTE (barrel). Sprint 1S (encerra o Bloco de Papéis e as 19
// entidades). (EnforcementLocus NÃO é re-exportado: o nome já é ocupado por MISSÃO
// no índice do domínio.)
//
// Nota: o CLIENTE não possui Value Object escalar próprio. O Canon (item 14) lista
// naturezas/relações (condição de uma Pessoa; relação de serviço; subordinada à
// dignidade), não um valor escalar. Os "Value Objects mínimos" são as referências
// imutáveis (refs.ts); criar um VO textual seria invenção fora do Canon.
// ─────────────────────────────────────────────────────────────────────────────
export { ClienteId } from './cliente-id.js';
export { ClienteAggregate } from './cliente.js';
export type { ClienteRecognitionInput } from './cliente.js';
export { ClientePersonRef, ClienteRecognitionResponsibleRef } from './refs.js';
export { ClienteRecognized } from './cliente-events.js';
export { clienteEntityInvariants, CLIENTE_INVARIANTS_MANIFEST } from './cliente-invariants.js';
export type { ClienteInvariantSpec } from './cliente-invariants.js';
