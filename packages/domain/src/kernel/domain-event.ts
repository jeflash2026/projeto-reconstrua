// ─────────────────────────────────────────────────────────────────────────────
// DomainEvent — fato de domínio já ocorrido (nomeado no passado). NÃO é a
// entidade EVENTO do Livro Mestre (isso vem em sprint futura); é a primitiva
// técnica de eventos de domínio do kernel. Puro.
// ─────────────────────────────────────────────────────────────────────────────

export interface DomainEvent {
  /** Nome estável do evento (ex.: 'algo.aconteceu'). */
  readonly eventName: string;
  /** Momento da ocorrência. */
  readonly occurredAt: Date;
  /** Identidade do agregado de origem, como string opaca. */
  readonly aggregateId: string;
}

export abstract class BaseDomainEvent implements DomainEvent {
  abstract readonly eventName: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;

  protected constructor(aggregateId: string, occurredAt: Date) {
    this.aggregateId = aggregateId;
    this.occurredAt = occurredAt;
  }
}
