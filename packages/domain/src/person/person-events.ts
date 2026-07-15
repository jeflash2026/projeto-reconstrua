// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da Pessoa — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: DF-23 / Lei do Reconhecimento — o Sistema RECONHECE (nunca cria) uma
// Pessoa. O marco é o reconhecimento; sua veiculação operacional é de sprints
// futuras. Aqui há apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Pessoa é oficialmente reconhecida (DF-23). */
export class PersonRecognized extends BaseDomainEvent {
  readonly eventName = 'person.recognized';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
