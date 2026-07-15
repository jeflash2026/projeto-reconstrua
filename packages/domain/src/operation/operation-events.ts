// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da Operação — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 11 — a Operação é o agir conduzido em função de uma missão
// (item 1), regido pelo Volume 03. A condução é o marco ontológico; a EXECUÇÃO das
// ações (R1–R9), a auditoria (R9) e a persistência pertencem a outras camadas, não
// aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Operação é conduzida em função de uma Missão (Entidade 11; INV-OP-01). */
export class OperationConducted extends BaseDomainEvent {
  readonly eventName = 'operation.conducted';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
