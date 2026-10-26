// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/application — Produção Real (Sprint 4A).
// ─────────────────────────────────────────────────────────────────────────────
export * from './production-config.js';
// Performance (2026-08-04): envelope de cache curto + voo único para as
// varreduras derivadas caras (o que travava o login do Atendimento Humanizado).
export * from './memo-curto.js';
// Performance (2026-10-26): teto de trilhas para as varreduras que PRECISAM
// da base inteira (a lista de clientes compunha 1.832 ALIRs em fila indiana).
export * from './em-paralelo.js';
