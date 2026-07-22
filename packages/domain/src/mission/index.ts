// ─────────────────────────────────────────────────────────────────────────────
// Entidade 01 — MISSÃO (barrel). Sprint 1B.
// ─────────────────────────────────────────────────────────────────────────────
export { MissionId } from './mission-id.js';
export { Mission } from './mission.js';
export type { MissionBirthInput } from './mission.js';
export { BeneficiaryPersonRef, InitialOperationalResponsibleRef } from './refs.js';
export { InitialObjective, OpeningReason } from './value-objects.js';
export { MissionCreated } from './mission-events.js';
export { missionEntityInvariants, MISSION_INVARIANTS_MANIFEST } from './mission-invariants.js';
export type { MissionInvariantSpec, EnforcementLocus } from './mission-invariants.js';
