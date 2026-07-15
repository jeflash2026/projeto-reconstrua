// ─────────────────────────────────────────────────────────────────────────────
// SqlClient — port mínimo de execução SQL, agnóstico de driver. Isola o adapter
// de banco (postgres) do restante da infraestrutura: os stores (PgEventStore,
// PgOutboxStore, PgSnapshotStore) dependem apenas desta interface.
// ─────────────────────────────────────────────────────────────────────────────
export type SqlRow = Record<string, unknown>;

export interface SqlClient {
  /** Executa uma query parametrizada e retorna as linhas. */
  query<T extends SqlRow = SqlRow>(text: string, params?: readonly unknown[]): Promise<T[]>;
  /** Executa `work` dentro de uma transação atômica. */
  transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T>;
}
