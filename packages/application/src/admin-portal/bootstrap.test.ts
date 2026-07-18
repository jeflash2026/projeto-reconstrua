// ─────────────────────────────────────────────────────────────────────────────
// GO-LIVE-05 · BUG 1 — o bootstrap do administrador é ONE-TIME e AUTORITATIVO no
// servidor: isBootstrapped() é a única verdade (∃ administrador ativo), nunca
// inferida contando lista no cliente. Uma vez inicializado, jamais reaparece;
// bootstrapFirstAdmin recusa o segundo (AlreadyBootstrappedError).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, UuidGenerator, Uuid } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import { HumanHandoffRuntime } from '../go-live/human-handoff-runtime.js';
import {
  AlreadyBootstrappedError,
  StaffDirectoryRuntime,
  type StaffMember,
  type StaffRole,
  type StaffStore,
} from './staff-directory.js';

class FixedClock implements Clock {
  now(): Date { return new Date('2026-07-19T12:00:00.000Z'); }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid { this.n += 1; return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`); }
}

/** Store em memória — persiste de verdade entre chamadas (imita o Postgres). */
function memStore(): StaffStore {
  const rows = new Map<string, StaffMember>();
  return {
    save: (m) => { rows.set(m.id, m); return Promise.resolve(); },
    byId: (id) => Promise.resolve(rows.get(id) ?? null),
    byRole: (role: StaffRole) => Promise.resolve([...rows.values()].filter((m) => m.role === role)),
    all: () => Promise.resolve([...rows.values()]),
  };
}

function runtime(store: StaffStore = memStore()): StaffDirectoryRuntime {
  const handoff = new HumanHandoffRuntime({ save: () => Promise.resolve(), byId: () => Promise.resolve(null), openByRole: () => Promise.resolve([]) });
  return new StaffDirectoryRuntime(store, handoff, new FixedClock(), new SeqUuid());
}

describe('StaffDirectory · bootstrap ONE-TIME (BUG 1)', () => {
  it('sistema novo → não inicializado; após criar o 1º admin → inicializado PARA SEMPRE', async () => {
    const dir = runtime();
    expect(await dir.isBootstrapped()).toBe(false);

    const admin = await dir.bootstrapFirstAdmin('Jessé Fundador');
    expect(admin.name).toBe('Jessé Fundador');
    expect(admin.role).toBe('administrador');

    // Releitura (o próximo login após logout): a verdade PERSISTE.
    expect(await dir.isBootstrapped()).toBe(true);
    // E de novo, e de novo — nunca volta a pedir bootstrap.
    expect(await dir.isBootstrapped()).toBe(true);
  });

  it('o segundo bootstrap é RECUSADO (AlreadyBootstrappedError) — nunca cria outro admin', async () => {
    const dir = runtime();
    await dir.bootstrapFirstAdmin('Jessé Fundador');
    await expect(dir.bootstrapFirstAdmin('Intruso')).rejects.toBeInstanceOf(AlreadyBootstrappedError);
    expect((await dir.list('administrador'))).toHaveLength(1); // só o primeiro
  });

  it('o nome do administrador PERSISTE na releitura (o cerne do bug relatado)', async () => {
    const store = memStore();
    await runtime(store).bootstrapFirstAdmin('Jessé Fundador');
    // Uma NOVA instância do runtime sobre o MESMO store (novo request/login):
    const outroLogin = runtime(store);
    const admins = await outroLogin.list('administrador');
    expect(admins.map((m) => m.name)).toEqual(['Jessé Fundador']);
    expect(await outroLogin.isBootstrapped()).toBe(true);
  });

  it('administrador DESATIVADO não conta como inicializado (fail-closed correto)', async () => {
    const dir = runtime();
    const admin = await dir.bootstrapFirstAdmin('Jessé Fundador');
    await dir.deactivate(admin.id);
    expect(await dir.isBootstrapped()).toBe(false); // sem admin ATIVO → pode reinicializar
  });
});
