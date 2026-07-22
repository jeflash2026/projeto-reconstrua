// ─────────────────────────────────────────────────────────────────────────────
// PostgresSqlClient — ÚNICA fronteira com o driver `postgres`. Os tipos complexos
// do driver ficam confinados aqui, atrás da interface `SqlClient`. Usa queries
// parametrizadas (`unsafe(text, params)`) e transações (`begin`).
// ─────────────────────────────────────────────────────────────────────────────
import postgres from 'postgres';
import type { SqlClient, SqlRow } from './sql-client.js';

/** Forma mínima do driver que utilizamos (isola os genéricos do `postgres`). */
interface DriverSql {
  unsafe(query: string, params?: readonly unknown[]): Promise<unknown[]>;
  begin<T>(callback: (tx: DriverSql) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

export interface PostgresSqlClientOptions {
  /** Tamanho do pool de conexões (default 10). */
  readonly max?: number;
}

export class PostgresSqlClient implements SqlClient {
  private constructor(private readonly sql: DriverSql) {}

  /** Conecta a partir de uma connection string (ex.: process.env.DATABASE_URL). */
  static connect(
    connectionString: string,
    options: PostgresSqlClientOptions = {},
  ): PostgresSqlClient {
    const driver = postgres(connectionString, {
      max: options.max ?? 10,
      prepare: true,
    }) as unknown as DriverSql;
    return new PostgresSqlClient(driver);
  }

  async query<T extends SqlRow = SqlRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const rows = await this.sql.unsafe(text, params);
    return rows as T[];
  }

  transaction<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.sql.begin((tx) => work(new PostgresSqlClient(tx)));
  }

  /** Encerra o pool. */
  close(): Promise<void> {
    return this.sql.end();
  }
}
