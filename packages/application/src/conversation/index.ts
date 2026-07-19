// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/application — Conversation Runtime (Sprint 2B).
// Camada 3 (Conversation) da ADR-0002A + humanização da entrega no WhatsApp.
// Consome intenções do Executive Brain (Camada 2) via port; NUNCA decide.
// ─────────────────────────────────────────────────────────────────────────────
export * from './percept.js';
export * from './intent.js';
export * from './phrasing.js';
export * from './humanization-policy.js';
export * from './ports.js';
export * from './session-runtime.js';
export * from './conversation-memory-runtime.js';
export * from './conversation-context-runtime.js';
export * from './prompt-builder-runtime.js';
export * from './conversation-dosage.js';
export * from './conversation-intelligence.js';
export * from './human-like-timing-runtime.js';
export * from './delay-runtime.js';
export * from './presence-runtime.js';
export * from './typing-runtime.js';
export * from './message-queue-runtime.js';
export * from './silence-detection-runtime.js';
export * from './delivery-runtime.js';
export * from './conversation-runtime.js';
