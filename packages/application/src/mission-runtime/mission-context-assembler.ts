// ─────────────────────────────────────────────────────────────────────────────
// MISSION CONTEXT ASSEMBLER — monta o MissionContext de um passo: a intenção do
// Brain + os fatos percebidos + as identidades correntes + o instante. É a entrada
// imutável que cada Use Case recebe. Não decide nada; apenas compõe.
// ─────────────────────────────────────────────────────────────────────────────
import type { MissionContext } from './use-case.js';
import type { MissionFacts, MissionIdentity, MissionUseCaseIntent } from './types.js';

export class MissionContextAssembler {
  assemble(
    intent: MissionUseCaseIntent,
    facts: MissionFacts,
    identity: MissionIdentity,
    now: Date,
  ): MissionContext {
    return { intent, facts, identity, now };
  }
}
