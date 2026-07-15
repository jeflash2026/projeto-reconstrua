// ─────────────────────────────────────────────────────────────────────────────
// MISSION RECOVERY RUNTIME — executa um Use Case com RESILIÊNCIA: um conflito de
// concorrência (stream já existe) é tratado como IDEMPOTÊNCIA (já executado → skip);
// qualquer outra falha vira resultado FALHO (sem meia-persistência: cada append é
// atômico no Event Store). Nunca engole a falha silenciosamente — ela fica no outcome.
// ─────────────────────────────────────────────────────────────────────────────
import { ConcurrencyConflictError } from '../event-store/index.js';
import { failedOutcome, skippedOutcome, type UseCaseOutcome } from './types.js';
import type { MissionContext, MissionUseCase } from './use-case.js';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'erro desconhecido';
}

export class MissionRecoveryRuntime {
  async run(useCase: MissionUseCase, ctx: MissionContext): Promise<UseCaseOutcome> {
    try {
      return await useCase.execute(ctx);
    } catch (error) {
      if (error instanceof ConcurrencyConflictError) {
        // Idempotência: o stream já existe (turno concorrente) → considerar já-executado.
        return skippedOutcome(useCase.name, useCase.streamType, '', {});
      }
      return failedOutcome(useCase.name, useCase.streamType, errorMessage(error));
    }
  }
}
