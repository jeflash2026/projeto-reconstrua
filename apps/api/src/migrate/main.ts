// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION RUNNER (MIG-01) — entrypoint DEDICADO, separado de production/main.ts.
// A APLICAÇÃO NUNCA executa DDL; este processo, sim — lendo os arquivos .sql de
// infrastructure/database/init/ e aplicando-os forward-only via schema_migrations.
// Serve tanto banco NOVO quanto banco JÁ EXISTENTE (adota o schema presente).
// Sai 0 em sucesso; ≠0 em falha (bloqueia o deploy — fail-closed, nunca corrompe).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PgMigrationClient, runMigrations, type Migration } from '@reconstrua/infrastructure';

// Chave do advisory lock: serializa runners concorrentes (um deploy por vez).
const ADVISORY_LOCK_KEY = 4915020251;

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    process.stderr.write('[migrate] DATABASE_URL ausente — abortando\n');
    process.exitCode = 1;
    return;
  }

  const migrationsDir = resolve(process.cwd(), process.env['MIGRATIONS_DIR'] ?? 'infrastructure/database/init');
  const ledgerSql = readFileSync(join(migrationsDir, '..', '_schema_migrations.sql'), 'utf8');
  const versions = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
  const migrations: readonly Migration[] = versions.map((version) => ({
    version,
    sql: readFileSync(join(migrationsDir, version), 'utf8'),
  }));
  process.stdout.write(`[migrate] ${String(migrations.length)} migration(s) em ${migrationsDir}\n`);

  const db = PgMigrationClient.connect(url);
  let locked = false;
  try {
    await db.rows('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    locked = true;
    await db.exec(ledgerSql); // garante o ledger (idempotente)
    const result = await runMigrations(db, migrations);
    process.stdout.write(
      `[migrate] aplicadas: ${result.applied.length === 0 ? '(nenhuma)' : result.applied.join(', ')}\n`,
    );
    process.stdout.write(`[migrate] já presentes: ${String(result.skipped.length)}\n`);
    process.stdout.write('[migrate] OK\n');
  } catch (error) {
    process.stderr.write(`[migrate] FALHA: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  } finally {
    if (locked) await db.rows('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
    await db.close();
  }
}

void main();
