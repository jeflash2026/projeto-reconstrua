// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do Cliente — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 19 — a condição de Cliente é RECONHECIDA a partir de uma Pessoa
// já reconhecida (item 7; R2; DF-23). O reconhecimento é o marco; a relação de
// serviço em curso, o encerramento da condição (item 9) e a persistência pertencem
// a outras camadas, não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Pessoa reconhecida assume/é reconhecida na condição de Cliente (Entidade 19; DF-23). */
export class ClienteRecognized extends BaseDomainEvent {
  readonly eventName = 'cliente.recognized';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
