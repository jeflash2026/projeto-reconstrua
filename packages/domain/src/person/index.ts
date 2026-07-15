// ─────────────────────────────────────────────────────────────────────────────
// Entidade 02 — PESSOA (barrel). Sprint 1B.
// ─────────────────────────────────────────────────────────────────────────────
export { PersonId } from './person-id.js';
export { Person } from './person.js';
export type { PersonRecognitionInput } from './person.js';
export { RecognitionResponsibleRef, EvidenceRef } from './refs.js';
export { CivilIdentity, RecognitionOrigin, KNOWN_RECOGNITION_ORIGINS } from './value-objects.js';
export { PersonRecognized } from './person-events.js';
export {
  personEntityInvariants,
  PERSON_INVARIANTS_MANIFEST,
} from './person-invariants.js';
export type { PersonInvariantSpec } from './person-invariants.js';
