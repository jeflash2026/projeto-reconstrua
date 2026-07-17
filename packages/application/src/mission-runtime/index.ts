// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/application — Mission Runtime (Sprint 2D). A AHRI EXECUTA o trabalho:
// Use Cases R1–R9 sobre agregados congelados, persistindo via Event Store (2A) e
// publicando via Dispatcher, sob decisão exclusiva do Executive Brain (2C).
// ─────────────────────────────────────────────────────────────────────────────
export * from './types.js';
export * from './perceived-fact.js';
export * from './ports.js';
export * from './provenance.js';
export * from './use-case.js';
export * from './mission-transaction-runtime.js';
export * from './mission-context-loader.js';
export * from './mission-context-assembler.js';
export * from './mission-validator.js';
export * from './mission-recovery-runtime.js';
export * from './mission-executor.js';
export * from './mission-pipeline.js';
export * from './mission-use-case-registry.js';
export * from './mission-audit-runtime.js';
export * from './mission-result-builder.js';
export * from './integrity-auditor.js';
export * from './mission-runtime.js';
export * from './use-cases/r1-recognize-person.js';
export * from './use-cases/r2-recognize-cliente.js';
export * from './use-cases/create-mission.js';
export * from './use-cases/r3-recognize-document.js';
export * from './use-cases/r4-recognize-event.js';
export * from './use-cases/r5-build-knowledge.js';
export * from './use-cases/r6-build-truth.js';
export * from './use-cases/r6-derive-state.js';
export * from './use-cases/close-mission.js';
export * from './use-cases/reopen-mission.js';
export * from './use-cases/r6-represent-stage.js';
export * from './use-cases/r7-execute-operation.js';
export * from './use-cases/r8-produce-projection.js';
export * from './use-cases/r9-audit-integral.js';
