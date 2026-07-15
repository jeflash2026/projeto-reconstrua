// ─────────────────────────────────────────────────────────────────────────────
// MISSION RESULT BUILDER — agrega os resultados dos Use Cases num MissionResult:
// sucesso global (todos ok), total de eventos anexados e a identidade final da
// missão (para o próximo turno). Pura.
// ─────────────────────────────────────────────────────────────────────────────
import type { MissionIdentity, MissionResult, UseCaseOutcome } from './types.js';

export class MissionResultBuilder {
  build(chatId: string, outcomes: readonly UseCaseOutcome[], identity: MissionIdentity): MissionResult {
    return {
      chatId,
      ok: outcomes.every((o) => o.ok),
      outcomes,
      appendedEvents: outcomes.reduce((sum, o) => sum + o.appended, 0),
      identity,
    };
  }
}
