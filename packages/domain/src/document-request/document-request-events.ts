// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio do DocumentRequest (GO-LIVE 15C · Workflow 2) — contratos
// puros, sem infraestrutura. O ciclo de vida completo da solicitação
// complementar: criada → mensagem ao cliente → (confirmação) → recebida →
// (reaberta) → … → cancelada; lembretes de SLA ao longo do caminho.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** O advogado criou formalmente a solicitação (status=PENDING). */
export class DocumentRequestCreated extends BaseDomainEvent {
  readonly eventName = 'document-request.created';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}

/** A AHRI entregou a mensagem da solicitação ao cliente. */
export class DocumentRequestMessaged extends BaseDomainEvent {
  readonly eventName = 'document-request.messaged';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}

/** Múltiplas pendências + dúvida: a AHRI pediu confirmação ao cliente. */
export class DocumentRequestConfirmationAsked extends BaseDomainEvent {
  readonly eventName = 'document-request.confirmation-asked';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}

/** Um documento do subsistema documental cumpriu a solicitação (→ RECEIVED). */
export class DocumentRequestReceived extends BaseDomainEvent {
  readonly eventName = 'document-request.received';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}

/** O advogado reabriu a solicitação (documento incorreto) — histórico preservado. */
export class DocumentRequestReopened extends BaseDomainEvent {
  readonly eventName = 'document-request.reopened';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}

/** O advogado cancelou a solicitação (condição de parada do SLA). */
export class DocumentRequestCancelled extends BaseDomainEvent {
  readonly eventName = 'document-request.cancelled';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}

/** Lembrete automático de SLA enviado ao cliente. */
export class DocumentRequestReminded extends BaseDomainEvent {
  readonly eventName = 'document-request.reminded';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
