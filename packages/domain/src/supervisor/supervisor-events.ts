// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do Supervisor — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 18 — o Supervisor é DESIGNADO pela Governança (item 7; DF-12). A
// designação é o marco; a SUPERVISÃO em si (verificar conformidade e acionar
// correções — R7), a transição (Art. 12º) e a persistência pertencem a outras
// camadas, não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Pessoa é designada Supervisor de uma Missão (Entidade 18; Art. 10º; DF-12). */
export class SupervisorDesignated extends BaseDomainEvent {
  readonly eventName = 'supervisor.designated';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
