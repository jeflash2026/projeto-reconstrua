// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da Etapa Operacional — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 09 — a Etapa DERIVA do Estado (item 7); não é fonte autônoma.
// A representação é o marco; sua veiculação e persistência pertencem a outras
// camadas, não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando um Estado Operacional passa a ser representado por uma Etapa (Entidade 09; INV-ET-01). */
export class OperationalStageRepresented extends BaseDomainEvent {
  readonly eventName = 'operational-stage.represented';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
