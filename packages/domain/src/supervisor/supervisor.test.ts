// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade SUPERVISOR — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { SupervisorAggregate } from './supervisor.js';
import type { SupervisorDesignationInput } from './supervisor.js';
import { SupervisorId } from './supervisor-id.js';
import { SupervisorPersonRef, SupervisorMissionRef, SupervisorAuthorityRef } from './refs.js';
import { SupervisorDesignated } from './supervisor-events.js';
import {
  supervisorEntityInvariants,
  SUPERVISOR_INVARIANTS_MANIFEST,
} from './supervisor-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const SUPERVISOR_UUID = '00000000-0000-4000-8000-000000000131';
const PERSON_UUID = '00000000-0000-4000-8000-000000000132';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const AUTH_UUID = '00000000-0000-4000-8000-000000000133';

function validInput(): SupervisorDesignationInput {
  return {
    id: SupervisorId.fromString(SUPERVISOR_UUID),
    person: SupervisorPersonRef.fromString(PERSON_UUID),
    mission: SupervisorMissionRef.fromString(MISSION_UUID),
    designatedBy: SupervisorAuthorityRef.fromString(AUTH_UUID),
    designatedAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

describe('SupervisorAggregate — designação (item 7; DF-12)', () => {
  it('designa uma Pessoa como Supervisor de uma Missão e emite SupervisorDesignated', () => {
    const result = SupervisorAggregate.designate(validInput());
    expect(result.isOk()).toBe(true);
    const s = result.unwrap();
    expect(s.person.personId).toBe(PERSON_UUID);
    expect(s.mission.missionId).toBe(MISSION_UUID);
    expect(s.designatedBy.authorityId).toBe(AUTH_UUID);
    const events = s.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SupervisorDesignated);
    expect(events[0]?.eventName).toBe('supervisor.designated');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-14T12:00:00.000Z');
    expect(s.pullDomainEvents()).toHaveLength(0);
  });

  it('SU-PESSOA — sem Pessoa é recusada (item 2)', () => {
    // @ts-expect-error item 2: a Pessoa é obrigatória.
    const result = SupervisorAggregate.designate({ ...validInput(), person: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('SU-PESSOA');
  });

  it('INV-SU-02 — sem Missão é recusada (supervisiona uma missão)', () => {
    // @ts-expect-error INV-SU-02: a Missão é obrigatória.
    const result = SupervisorAggregate.designate({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-SU-02');
  });

  it('SU-AUTORIZADO — sem autoridade designante é recusada (DF-12)', () => {
    // @ts-expect-error DF-12: a autoridade designante é obrigatória.
    const result = SupervisorAggregate.designate({ ...validInput(), designatedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('SU-AUTORIZADO');
  });

  it('SU-DATADO — datação inválida é recusada (Art. 14º)', () => {
    const result = SupervisorAggregate.designate({ ...validInput(), designatedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('SU-DATADO');
  });
});

describe('SupervisorAggregate — identidade', () => {
  it('mesma SupervisorId => igual; ids diferentes => diferentes', () => {
    const a = SupervisorAggregate.designate(validInput()).unwrap();
    const b = SupervisorAggregate.designate(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = SupervisorAggregate.designate({
      ...validInput(),
      id: SupervisorId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('SupervisorAggregate — estrutura: supervisiona, não executa/decide/produz/conduz (INV-SU-01; itens 4/13/17)', () => {
  it('não expõe ato privativo, decisão jurídica, condução, prova técnica, criação de verdade, alteração de estado nem titularidade', () => {
    const s = SupervisorAggregate.designate(validInput()).unwrap();
    for (const forbidden of [
      'privativeAct',
      'atoPrivativo',
      'decideJuridical',
      'advocacy',
      'advocacia',
      'produceProof',
      'produzirProva',
      'executePericia',
      'conductOperation',
      'conducaoDiaria',
      'alterState',
      'createTruth',
      'titularity',
      'titularidade',
      'ownMission',
    ]) {
      expect(forbidden in s).toBe(false);
    }
  });
});

describe('SupervisorAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Supervisor designado satisfaz as invariantes de entidade', () => {
    const s = SupervisorAggregate.designate(validInput()).unwrap();
    const result = InvariantsEngine.enforce(s, supervisorEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('SupervisorAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-SU-01..INV-SU-03, sem lacunas nem duplicatas', () => {
    const ids = SUPERVISOR_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-SU-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('INV-SU-01/02 são entity; INV-SU-03 é use-case (critérios na Governança)', () => {
    const byId = new Map(SUPERVISOR_INVARIANTS_MANIFEST.map((s) => [s.id, s.enforcement]));
    expect(byId.get('INV-SU-01')).toBe('entity');
    expect(byId.get('INV-SU-02')).toBe('entity');
    expect(byId.get('INV-SU-03')).toBe('use-case');
  });
});
