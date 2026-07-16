// ─────────────────────────────────────────────────────────────────────────────
// MigrationDb — a fronteira mínima de banco que o runner de migrations usa.
// `exec` roda SQL cru em protocolo SIMPLES (multi-statement + corpos `$$…$$` OK,
// SEM parâmetros); `rows` roda queries parametrizadas do ledger. Abstrai o driver
// para permitir testes com um fake determinístico.
// ─────────────────────────────────────────────────────────────────────────────
export interface MigrationDb {
  /** Executa SQL cru (multi-statement, sem parâmetros) — para arquivos de migration e BEGIN/COMMIT. */
  exec(sql: string): Promise<void>;
  /** Query parametrizada (usada apenas no ledger schema_migrations). */
  rows<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<T[]>;
  /** Encerra a conexão. */
  close(): Promise<void>;
}
