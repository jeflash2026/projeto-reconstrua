// ─────────────────────────────────────────────────────────────────────────────
// Testes do MIGRATOR (MIG-01) — prova a lógica forward-only/idempotente com um
// FakeDb determinístico que simula fielmente o ledger e a transação (o INSERT só
// fica visível após COMMIT; ROLLBACK descarta). Prova: banco novo, banco
// existente, execução única, detecção de checksum e falha correta (fail-closed).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { runMigrations, checksumOf, MigrationChecksumError, type Migration } from './migrator.js';
import type { MigrationDb } from './migration-db.js';

class FakeDb implements MigrationDb {
  readonly execLog: string[] = [];
  readonly ledger = new Map<string, string>();
  private pending: { version: string; checksum: string } | null = null;
  private readonly throwOn: string;

  constructor(seed: ReadonlyArray<readonly [string, string]> = [], throwOn = '__NO_THROW__') {
    for (const [version, checksum] of seed) this.ledger.set(version, checksum);
    this.throwOn = throwOn;
  }

  async exec(sql: string): Promise<void> {
    this.execLog.push(
      sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' ? sql : `SQL:${sql.slice(0, 20)}`,
    );
    if (sql === 'BEGIN') return Promise.resolve();
    if (sql === 'COMMIT') {
      if (this.pending) {
        this.ledger.set(this.pending.version, this.pending.checksum);
        this.pending = null;
      }
      return Promise.resolve();
    }
    if (sql === 'ROLLBACK') {
      this.pending = null;
      return Promise.resolve();
    }
    if (sql.includes(this.throwOn)) throw new Error('falha de DDL simulada');
    return Promise.resolve();
  }

  rows<T = Record<string, unknown>>(text: string, params: readonly unknown[] = []): Promise<T[]> {
    if (text.startsWith('SELECT version, checksum')) {
      return Promise.resolve(
        [...this.ledger].map(([version, checksum]) => ({ version, checksum })) as unknown as T[],
      );
    }
    if (text.startsWith('INSERT INTO schema_migrations')) {
      this.pending = { version: String(params[0]), checksum: String(params[1]) };
      return Promise.resolve([] as T[]);
    }
    return Promise.resolve([] as T[]);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

const M = (version: string, sql: string): Migration => ({ version, sql });

describe('MIG-01 · runMigrations', () => {
  it('banco NOVO: aplica todas em ordem e registra no ledger (uma transação por migration)', async () => {
    const db = new FakeDb();
    const migs = [M('01.sql', 'create a'), M('02.sql', 'create b'), M('03.sql', 'create c')];
    const res = await runMigrations(db, migs);
    expect(res.applied).toEqual(['01.sql', '02.sql', '03.sql']);
    expect(res.skipped).toEqual([]);
    expect(db.ledger.size).toBe(3);
    expect(db.execLog.filter((s) => s === 'BEGIN')).toHaveLength(3);
    expect(db.execLog.filter((s) => s === 'COMMIT')).toHaveLength(3);
  });

  it('banco EXISTENTE: migrations já aplicadas são puladas (nenhuma reaplicação)', async () => {
    const migs = [M('01.sql', 'create a'), M('02.sql', 'create b')];
    const seed = migs.map((m) => [m.version, checksumOf(m.sql)] as const);
    const db = new FakeDb(seed);
    const res = await runMigrations(db, migs);
    expect(res.applied).toEqual([]);
    expect(res.skipped).toEqual(['01.sql', '02.sql']);
    expect(db.execLog.filter((s) => s === 'BEGIN')).toHaveLength(0);
  });

  it('executada apenas UMA vez (rodar 2×: a 2ª não aplica nada)', async () => {
    const db = new FakeDb();
    const migs = [M('01.sql', 'create a')];
    await runMigrations(db, migs);
    const res2 = await runMigrations(db, migs);
    expect(res2.applied).toEqual([]);
    expect(res2.skipped).toEqual(['01.sql']);
    expect(db.ledger.size).toBe(1);
  });

  it('checksum ALTERADO de migration aplicada ⇒ falha (forward-only)', async () => {
    const db = new FakeDb([['01.sql', checksumOf('conteudo ORIGINAL')]]);
    const migs = [M('01.sql', 'conteudo EDITADO')];
    await expect(runMigrations(db, migs)).rejects.toBeInstanceOf(MigrationChecksumError);
    expect(db.ledger.get('01.sql')).toBe(checksumOf('conteudo ORIGINAL')); // ledger intacto
  });

  it('falha de uma migration ⇒ ROLLBACK e não registra (fail-closed)', async () => {
    const db = new FakeDb([], '__BOOM__');
    const migs = [M('01.sql', 'create a'), M('02.sql', 'DDL __BOOM__'), M('03.sql', 'create c')];
    await expect(runMigrations(db, migs)).rejects.toThrow('falha de DDL');
    expect(db.ledger.has('01.sql')).toBe(true); // a 1ª comitou
    expect(db.ledger.has('02.sql')).toBe(false); // a 2ª deu ROLLBACK
    expect(db.ledger.has('03.sql')).toBe(false); // a 3ª nem rodou
    expect(db.execLog).toContain('ROLLBACK');
  });

  it('checksum normaliza CRLF/LF (mesmo conteúdo ⇒ mesmo checksum)', () => {
    expect(checksumOf('a\r\nb\r\n')).toBe(checksumOf('a\nb\n'));
  });
});
