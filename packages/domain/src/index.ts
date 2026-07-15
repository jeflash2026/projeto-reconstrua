// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/domain — Camada de DOMÍNIO (soberana, sem dependência de tecnologia).
//
// Sprint 1A: Kernel do Domínio (primitivas puras).
// Sprint 1B–1S: as 19 Entidades Fundamentais, uma a uma. Implementadas: MISSÃO,
// PESSOA, DOCUMENTO, EVENTO, CASO, PROCESSO, VERDADE OPERACIONAL, ESTADO
// OPERACIONAL, ETAPA OPERACIONAL, PROJEÇÃO, OPERAÇÃO, REGRA OPERACIONAL, PERÍCIA,
// AHRI, OPERADOR, PERITO, ADVOGADO, SUPERVISOR, CLIENTE. Núcleo Cognitivo (07–09);
// Bloco de Papéis (14–19). MODELO DE DOMÍNIO COMPLETO (19/19).
// ─────────────────────────────────────────────────────────────────────────────
export const LAYER = 'reconstrua/domain' as const;

export * from './kernel/index.js';
export * from './mission/index.js';
export * from './person/index.js';
export * from './document/index.js';
export * from './event/index.js';
export * from './case/index.js';
export * from './process/index.js';
export * from './operational-truth/index.js';
export * from './operational-state/index.js';
export * from './operational-stage/index.js';
export * from './projection/index.js';
export * from './operation/index.js';
export * from './operational-rule/index.js';
export * from './pericia/index.js';
export * from './ahri/index.js';
export * from './operador/index.js';
export * from './perito/index.js';
export * from './advogado/index.js';
export * from './supervisor/index.js';
export * from './cliente/index.js';
