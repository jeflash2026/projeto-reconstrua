// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do Operador — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 15 — o Operador é DESIGNADO pela Governança (item 7; DF-12). A
// designação é o marco; a condução operacional diária (OPERAÇÃO/R7), a transição
// que preserva contexto (Art. 12º) e a persistência pertencem a outras camadas,
// não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Pessoa é designada Operador de uma Missão (Entidade 15; DF-10; DF-12). */
export class OperadorDesignated extends BaseDomainEvent {
  readonly eventName = 'operador.designated';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
