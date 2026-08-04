// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/application — Produção Real (Sprint 4A).
// ─────────────────────────────────────────────────────────────────────────────
export * from './production-config.js';
// Performance (2026-08-04): envelope de cache curto + voo único para as
// varreduras derivadas caras (o que travava o login do Atendimento Humanizado).
export * from './memo-curto.js';
