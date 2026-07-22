// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/application — JORNADA COMERCIAL (decreto 2026-07-20): a máquina de
// estados determinística que governa da primeira mensagem à ativação do Portal.
// A LLM não decide nenhum passo; as respostas do funil são autoradas aqui.
// ─────────────────────────────────────────────────────────────────────────────
export * from './jornada-comercial.js';
// Decreto 2026-07-22: reaquecimento de leads frios — autorizado pelo admin.
export * from './reaquecimento.js';
