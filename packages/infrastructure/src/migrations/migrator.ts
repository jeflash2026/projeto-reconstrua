// ─────────────────────────────────────────────────────────────────────────────
// MIGRATOR — a lógica FORWARD-ONLY e IDEMPOTENTE do runner (pura, testável).
// Aplica apenas migrations ainda não registradas no ledger schema_migrations, em
// ordem, UMA por transação. Recalcula o checksum das já aplicadas e FALHA se o
// conteúdo tiver mudado (proteção forward-only). Nenhuma DDL vive aqui.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import type { MigrationDb } from './migration-db.js';

export interface Migration {
  readonly version: string; // nome do arquivo, ordenável (ex.: '01-event-store.sql')
  readonly sql: string;
}

export interface MigrationRunResult {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
}

export class MigrationChecksumError extends Error {
  constructor(version: string, expected: string, actual: string) {
    super(
      `migration '${version}' já aplicada com checksum ${expected}, mas o arquivo atual tem checksum ${actual} ` +
        `(forward-only: migrations aplicadas não podem ser editadas — crie uma nova)`,
    );
    this.name = 'MigrationChecksumError';
  }
}

/** sha256 hex do conteúdo normalizado para LF (imune a diferença CRLF/LF entre SOs). */
export function checksumOf(content: string): string {
  const lf = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return createHash('sha256').update(lf, 'utf8').digest('hex');
}

/**
 * Aplica as migrations pendentes. O ledger (schema_migrations) deve existir
 * (o entrypoint o cria antes). Suporta banco NOVO (ledger vazio ⇒ aplica tudo) e
 * banco EXISTENTE (ledger com versões ⇒ pula as já aplicadas). Idempotente.
 */
export async function runMigrations(db: MigrationDb, migrations: readonly Migration[]): Promise<MigrationRunResult> {
  const rows = await db.rows<{ version: string; checksum: string }>('SELECT version, checksum FROM schema_migrations');
  const applied = new Map(rows.map((r) => [r.version, r.checksum] as const));

  const appliedNow: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    const sum = checksumOf(migration.sql);
    const previous = applied.get(migration.version);

    if (previous !== undefined) {
      if (previous !== sum) throw new MigrationChecksumError(migration.version, previous, sum);
      skipped.push(migration.version);
      continue;
    }

    await db.exec('BEGIN');
    try {
      await db.exec(migration.sql);
      await db.rows('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [migration.version, sum]);
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
    appliedNow.push(migration.version);
  }

  return { applied: appliedNow, skipped };
}
