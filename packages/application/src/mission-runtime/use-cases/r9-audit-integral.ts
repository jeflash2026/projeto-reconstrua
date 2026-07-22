// ─────────────────────────────────────────────────────────────────────────────
// R9 — AUDITORIA INTEGRAL. Verifica a INTEGRIDADE da cadeia de eventos de todos os
// streams da missão (sequência + hash-chain; R9/2A). É LEITURA + VERIFICAÇÃO — não
// muta domínio, não anexa evento. Falha de integridade ⇒ resultado impedido.
// ─────────────────────────────────────────────────────────────────────────────
import type { IntegrityAuditorPort } from '../ports.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import type { MissionContext, MissionUseCase } from '../use-case.js';

export class AuditIntegralUseCase implements MissionUseCase {
  readonly name = 'AuditIntegral';
  readonly streamType = 'audit';
  constructor(private readonly auditor: IntegrityAuditorPort) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    const report = await this.auditor.verify(ctx.identity);
    if (!report.ok) {
      return failedOutcome(
        this.name,
        this.streamType,
        report.error ?? 'integridade da cadeia violada (R9)',
      );
    }
    return {
      useCase: this.name,
      ok: true,
      skipped: false,
      streamType: this.streamType,
      streamId: null,
      appended: 0,
      eventTypes: [],
      identityPatch: {},
      error: null,
    };
  }
}
