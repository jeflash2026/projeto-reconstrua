// ─────────────────────────────────────────────────────────────────────────────
// PgMigrationClient — implementação de MigrationDb sobre o driver `postgres`
// (o MESMO driver já usado pela infra), em modo SIMPLES (`prepare: false`) para
// que arquivos DDL multi-statement com corpos `$$…$$` (funções de trigger) sejam
// aplicados por inteiro. Conexão única (max: 1) — o runner é sequencial.
// NÃO reutiliza o SqlClient do Event Store (que usa protocolo parametrizado e não
// executa multi-statement) e NÃO toca nenhum arquivo do Event Store.
// ─────────────────────────────────────────────────────────────────────────────
import postgres from 'postgres';
import type { MigrationDb } from './migration-db.js';

/** Forma mínima do driver `postgres` que o runner utiliza (isola os genéricos). */
interface RawSql {
  unsafe(query: string, params?: readonly unknown[]): Promise<unknown[]>;
  end(): Promise<void>;
}

export class PgMigrationClient implements MigrationDb {
  private constructor(private readonly sql: RawSql) {}

  /** Conecta a partir da connection string (ex.: process.env.DATABASE_URL). */
  static connect(connectionString: string): PgMigrationClient {
    const driver = postgres(connectionString, { max: 1, prepare: false }) as unknown as RawSql;
    return new PgMigrationClient(driver);
  }

  async exec(sql: string): Promise<void> {
    await this.sql.unsafe(sql);
  }

  async rows<T = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await this.sql.unsafe(text, params);
    return result as T[];
  }

  close(): Promise<void> {
    return this.sql.end();
  }
}
