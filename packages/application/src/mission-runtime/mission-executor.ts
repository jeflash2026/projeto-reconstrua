// ─────────────────────────────────────────────────────────────────────────────
// MISSION EXECUTOR — executa UM Use Case: valida pré-condições universais
// (MissionValidator) e delega ao MissionRecoveryRuntime (que dá idempotência e
// isolamento de falha). É o ponto único por onde um Use Case corre.
// ─────────────────────────────────────────────────────────────────────────────
import type { MissionRecoveryRuntime } from './mission-recovery-runtime.js';
import type { MissionValidator } from './mission-validator.js';
import { failedOutcome, type UseCaseOutcome } from './types.js';
import type { MissionContext, MissionUseCase } from './use-case.js';

export class MissionExecutor {
  constructor(
    private readonly validator: MissionValidator,
    private readonly recovery: MissionRecoveryRuntime,
  ) {}

  async execute(useCase: MissionUseCase, ctx: MissionContext): Promise<UseCaseOutcome> {
    const validation = this.validator.validate(ctx);
    if (!validation.ok) {
      return failedOutcome(useCase.name, useCase.streamType, validation.error ?? 'pré-condição inválida');
    }
    return this.recovery.run(useCase, ctx);
  }
}
