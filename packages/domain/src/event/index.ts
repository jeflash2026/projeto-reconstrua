// ─────────────────────────────────────────────────────────────────────────────
// Entidade 04 — EVENTO (barrel). Sprint 1D.
// ─────────────────────────────────────────────────────────────────────────────
export { EventId } from './event-id.js';
export { EventAggregate } from './event.js';
export type { EventRecognitionInput } from './event.js';
export { EventMissionRef, FactRef, EventRecognitionResponsibleRef } from './refs.js';
export { EventClassification } from './event-classification.js';
export type { EventClassificationValue } from './event-classification.js';
export { EventRecognized } from './event-events.js';
export { eventEntityInvariants, EVENT_INVARIANTS_MANIFEST } from './event-invariants.js';
export type { EventInvariantSpec } from './event-invariants.js';
