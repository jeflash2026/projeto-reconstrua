// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade ADVOGADO — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { AdvogadoAggregate } from './advogado.js';
import type { AdvogadoDesignationInput } from './advogado.js';
import { AdvogadoId } from './advogado-id.js';
import { AdvogadoPersonRef, AdvogadoMissionRef, AdvogadoAuthorityRef } from './refs.js';
import { AdvogadoDesignated } from './advogado-events.js';
import { advogadoEntityInvariants, ADVOGADO_INVARIANTS_MANIFEST } from './advogado-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const ADVOGADO_UUID = '00000000-0000-4000-8000-000000000121';
const PERSON_UUID = '00000000-0000-4000-8000-000000000122';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const AUTH_UUID = '00000000-0000-4000-8000-000000000123';

function validInput(): AdvogadoDesignationInput {
  return {
    id: AdvogadoId.fromString(ADVOGADO_UUID),
    person: AdvogadoPersonRef.fromString(PERSON_UUID),
    mission: AdvogadoMissionRef.fromString(MISSION_UUID),
    designatedBy: AdvogadoAuthorityRef.fromString(AUTH_UUID),
    designatedAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

describe('AdvogadoAggregate — designação (item 7; DF-12)', () => {
  it('designa uma Pessoa como Advogado de uma Missão e emite AdvogadoDesignated', () => {
    const result = AdvogadoAggregate.designate(validInput());
    expect(result.isOk()).toBe(true);
    const a = result.unwrap();
    expect(a.person.personId).toBe(PERSON_UUID);
    expect(a.mission.missionId).toBe(MISSION_UUID);
    expect(a.designatedBy.authorityId).toBe(AUTH_UUID);
    const events = a.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(AdvogadoDesignated);
    expect(events[0]?.eventName).toBe('advogado.designated');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-14T12:00:00.000Z');
    expect(a.pullDomainEvents()).toHaveLength(0);
  });

  it('AD-PESSOA — sem Pessoa é recusada (item 1)', () => {
    // @ts-expect-error item 1: a Pessoa é obrigatória.
    const result = AdvogadoAggregate.designate({ ...validInput(), person: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('AD-PESSOA');
  });

  it('INV-AD-03 — sem Missão é recusada (atua sobre uma missão)', () => {
    // @ts-expect-error INV-AD-03: a Missão é obrigatória.
    const result = AdvogadoAggregate.designate({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-AD-03');
  });

  it('AD-AUTORIZADO — sem autoridade designante é recusada (DF-12)', () => {
    // @ts-expect-error DF-12: a autoridade designante é obrigatória.
    const result = AdvogadoAggregate.designate({ ...validInput(), designatedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('AD-AUTORIZADO');
  });

  it('AD-DATADO — datação inválida é recusada (Art. 14º)', () => {
    const result = AdvogadoAggregate.designate({ ...validInput(), designatedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('AD-DATADO');
  });
});

describe('AdvogadoAggregate — identidade', () => {
  it('mesma AdvogadoId => igual; ids diferentes => diferentes', () => {
    const a = AdvogadoAggregate.designate(validInput()).unwrap();
    const b = AdvogadoAggregate.designate(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = AdvogadoAggregate.designate({
      ...validInput(),
      id: AdvogadoId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('AdvogadoAggregate — estrutura: não executa decisão/assinatura, não faz perícia/condução, não cria verdade nem altera estado (itens 4/13; INV-AD/EO)', () => {
  it('não expõe execução de decisão, perícia, condução operacional, criação de verdade, alteração de estado nem titularidade', () => {
    const a = AdvogadoAggregate.designate(validInput()).unwrap();
    for (const forbidden of [
      'conductOperation',
      'conducaoDiaria',
      'produceProof',
      'produzirProva',
      'executePericia',
      'alterState',
      'alterarEstado',
      'alterTruth',
      'createTruth',
      'createFact',
      'titularity',
      'titularidade',
      'ownMission',
    ]) {
      expect(forbidden in a).toBe(false);
    }
  });
});

describe('AdvogadoAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Advogado designado satisfaz as invariantes de entidade', () => {
    const a = AdvogadoAggregate.designate(validInput()).unwrap();
    const result = InvariantsEngine.enforce(a, advogadoEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('AdvogadoAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-AD-01..INV-AD-03, sem lacunas nem duplicatas', () => {
    const ids = ADVOGADO_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-AD-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('INV-AD-01/02 são cross-entity (exclusividade sistêmica); INV-AD-03 é entity', () => {
    const byId = new Map(ADVOGADO_INVARIANTS_MANIFEST.map((s) => [s.id, s.enforcement]));
    expect(byId.get('INV-AD-01')).toBe('cross-entity');
    expect(byId.get('INV-AD-02')).toBe('cross-entity');
    expect(byId.get('INV-AD-03')).toBe('entity');
  });
});
