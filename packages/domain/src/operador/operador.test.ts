// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade OPERADOR — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { OperadorAggregate } from './operador.js';
import type { OperadorDesignationInput } from './operador.js';
import { OperadorId } from './operador-id.js';
import { OperadorPersonRef, OperadorMissionRef, OperadorAuthorityRef } from './refs.js';
import { OperadorDesignated } from './operador-events.js';
import { operadorEntityInvariants, OPERADOR_INVARIANTS_MANIFEST } from './operador-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const OPERADOR_UUID = '00000000-0000-4000-8000-000000000101';
const PERSON_UUID = '00000000-0000-4000-8000-000000000102';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const AUTH_UUID = '00000000-0000-4000-8000-000000000103';

function validInput(): OperadorDesignationInput {
  return {
    id: OperadorId.fromString(OPERADOR_UUID),
    person: OperadorPersonRef.fromString(PERSON_UUID),
    mission: OperadorMissionRef.fromString(MISSION_UUID),
    designatedBy: OperadorAuthorityRef.fromString(AUTH_UUID),
    designatedAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

describe('OperadorAggregate — designação (item 7; DF-12)', () => {
  it('designa uma Pessoa como Operador de uma Missão e emite OperadorDesignated', () => {
    const result = OperadorAggregate.designate(validInput());
    expect(result.isOk()).toBe(true);
    const o = result.unwrap();
    expect(o.person.personId).toBe(PERSON_UUID);
    expect(o.mission.missionId).toBe(MISSION_UUID);
    expect(o.designatedBy.authorityId).toBe(AUTH_UUID);
    const events = o.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OperadorDesignated);
    expect(events[0]?.eventName).toBe('operador.designated');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-14T12:00:00.000Z');
    expect(o.pullDomainEvents()).toHaveLength(0);
  });

  it('OPr-PESSOA — sem Pessoa é recusada (item 1)', () => {
    // @ts-expect-error item 1: a Pessoa é obrigatória.
    const result = OperadorAggregate.designate({ ...validInput(), person: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('OPr-PESSOA');
  });

  it('INV-OPr-01 — sem Missão é recusada (atua sobre uma missão)', () => {
    // @ts-expect-error INV-OPr-01: a Missão é obrigatória.
    const result = OperadorAggregate.designate({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-OPr-01');
  });

  it('OPr-AUTORIZADO — sem autoridade designante é recusada (DF-12)', () => {
    // @ts-expect-error DF-12: a autoridade designante é obrigatória.
    const result = OperadorAggregate.designate({ ...validInput(), designatedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('OPr-AUTORIZADO');
  });

  it('OPr-DATADO — datação inválida é recusada (Art. 14º)', () => {
    const result = OperadorAggregate.designate({ ...validInput(), designatedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('OPr-DATADO');
  });
});

describe('OperadorAggregate — identidade', () => {
  it('mesma OperadorId => igual; ids diferentes => diferentes', () => {
    const a = OperadorAggregate.designate(validInput()).unwrap();
    const b = OperadorAggregate.designate(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = OperadorAggregate.designate({
      ...validInput(),
      id: OperadorId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('OperadorAggregate — estrutura: não pratica privativo, não decide, não detém titularidade (INV-OPr-01/02; itens 13/17)', () => {
  it('não expõe ato privativo, decisão jurídica, titularidade nem condução autônoma', () => {
    const o = OperadorAggregate.designate(validInput()).unwrap();
    for (const forbidden of [
      'privativeAct',
      'atoPrivativo',
      'decideJuridical',
      'decideJuridica',
      'decideLegal',
      'sign',
      'assinar',
      'parecer',
      'ownMission',
      'titularity',
      'titularidade',
      'produceProof',
    ]) {
      expect(forbidden in o).toBe(false);
    }
  });
});

describe('OperadorAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Operador designado satisfaz as invariantes de entidade', () => {
    const o = OperadorAggregate.designate(validInput()).unwrap();
    const result = InvariantsEngine.enforce(o, operadorEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('OperadorAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-OPr-01..INV-OPr-03, sem lacunas nem duplicatas', () => {
    const ids = OPERADOR_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const id of ['INV-OPr-01', 'INV-OPr-02', 'INV-OPr-03']) {
      expect(ids).toContain(id);
    }
  });

  it('INV-OPr-01/02 são de locus entity; INV-OPr-03 é use-case', () => {
    const byId = new Map(OPERADOR_INVARIANTS_MANIFEST.map((s) => [s.id, s.enforcement]));
    expect(byId.get('INV-OPr-01')).toBe('entity');
    expect(byId.get('INV-OPr-02')).toBe('entity');
    expect(byId.get('INV-OPr-03')).not.toBe('entity');
  });
});
