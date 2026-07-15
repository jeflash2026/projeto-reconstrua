// ─────────────────────────────────────────────────────────────────────────────
// ReadModel / ReadModelStore — ports do lado de LEITURA (CQRS constitucional).
// As interfaces consomem projeções derivadas da Verdade Operacional (DF-08;
// item 12), nunca o event store. Interfaces apenas. Puro.
// ─────────────────────────────────────────────────────────────────────────────

/** Marcador estrutural: um Read Model é uma projeção somente-leitura. */
export interface ReadModel {
  readonly projectedAt: Date;
}

/** Consulta um Read Model. A implementação lê apenas do schema de leitura. */
export interface ReadModelStore<TQuery, TView extends ReadModel> {
  query(query: TQuery): Promise<TView | null>;
}

/** Projeta eventos de domínio em Read Models. Implementado na infraestrutura. */
export interface Projector<TEvent> {
  project(event: TEvent): Promise<void>;
}
