// ─────────────────────────────────────────────────────────────────────────────
// Entidade 03 — DOCUMENTO (barrel). Sprint 1C.
// ─────────────────────────────────────────────────────────────────────────────
export { DocumentId } from './document-id.js';
export { DocumentAggregate } from './document.js';
export type { DocumentRecognitionInput } from './document.js';
export { MissionRef, DocumentRecognitionResponsibleRef } from './refs.js';
export { DocumentOrigin, ContentReference, KNOWN_DOCUMENT_ORIGINS } from './value-objects.js';
export { DocumentRecognized } from './document-events.js';
export {
  documentEntityInvariants,
  DOCUMENT_INVARIANTS_MANIFEST,
} from './document-invariants.js';
export type { DocumentInvariantSpec } from './document-invariants.js';
