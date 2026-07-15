// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/infrastructure — Conversation adapters (Sprint 2B).
// Evolution API (webhook + gateway), stores in-memory, LLM doubles, sleeper,
// gateway de teste, Brain de referência e a raiz de composição.
// ─────────────────────────────────────────────────────────────────────────────
export * from './json.js';
export * from './evolution/http-client.js';
export * from './evolution/evolution-webhook-mapper.js';
export * from './evolution/evolution-gateway.js';
export * from './in-memory-conversation-store.js';
export * from './in-memory-session-store.js';
export * from './in-memory-message-queue-store.js';
export * from './in-memory-conversation-gateway.js';
export * from './system-sleeper.js';
export * from './fake-llm.js';
export * from './deterministic-executive-brain.js';
export * from './build-conversation-runtime.js';
