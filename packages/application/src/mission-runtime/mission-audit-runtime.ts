// ─────────────────────────────────────────────────────────────────────────────
// MISSION AUDIT RUNTIME — registra cada execução (intenção + resultados por Use
// Case) num MissionAuditSink, tornando TODA execução rastreável. Auditoria de
// INTEGRAÇÃO (coordenação), separada do Event Store de domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { MissionAuditSink } from './ports.js';
import type { MissionUseCaseIntent, UseCaseOutcome } from './types.js';

export class MissionAuditRuntime {
  constructor(
    private readonly sink: MissionAuditSink | undefined,
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
  ) {}

  async record(
    chatId: string,
    intent: MissionUseCaseIntent,
    outcomes: readonly UseCaseOutcome[],
  ): Promise<void> {
    if (!this.sink) return;
    await this.sink.record({
      id: this.uuid.next(),
      chatId,
      at: this.clock.now(),
      intent,
      outcomes,
      ok: outcomes.every((o) => o.ok),
    });
  }
}
