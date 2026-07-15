// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do Advogado — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 17 — o Advogado é DESIGNADO pela Governança (item 7; DF-12). A
// designação é o marco; a DECISÃO jurídica (ato humano do advogado), a assinatura,
// a condução de processos, a transição (Art. 12º) e a persistência pertencem a
// outras camadas, não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Pessoa é designada Advogado de uma Missão (Entidade 17; DF-10; DF-12). */
export class AdvogadoDesignated extends BaseDomainEvent {
  readonly eventName = 'advogado.designated';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
