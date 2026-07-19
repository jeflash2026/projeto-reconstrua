// ─────────────────────────────────────────────────────────────────────────────
// AUTONOMOUS EXECUTION PIPELINE (GO-LIVE 10D) — o único ponto de entrada oficial
// de um turno de produção: processTurn() percorre toda a cadeia Truth →
// Strategic Reasoning → Executive Mind → Planner → Mission → Conversation,
// auditada de ponta a ponta. Adotado progressivamente; legado intacto.
// ─────────────────────────────────────────────────────────────────────────────
export * from './process-turn.js';
export * from './autonomous-brain-adapter.js';
export * from './mission-closure-feedback-subscriber.js';
