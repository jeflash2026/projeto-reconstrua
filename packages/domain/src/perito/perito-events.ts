// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do Perito — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 16 — o Perito é DESIGNADO pela Governança (item 7; DF-12). A
// designação é o marco; a PRODUÇÃO da prova técnica (ato humano do perito), o
// reconhecimento do laudo como DOCUMENTO (03), a transição (Art. 12º) e a
// persistência pertencem a outras camadas, não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Pessoa é designada Perito numa fase pericial de uma Missão (Entidade 16; DF-10; DF-12). */
export class PeritoDesignated extends BaseDomainEvent {
  readonly eventName = 'perito.designated';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
