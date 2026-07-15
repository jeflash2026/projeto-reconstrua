// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade PERITO — unitários + invariantes. Cada teste cita a norma do
// Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { PeritoAggregate } from './perito.js';
import type { PeritoDesignationInput } from './perito.js';
import { PeritoId } from './perito-id.js';
import {
  PeritoPersonRef,
  PeritoMissionRef,
  PeritoExpertiseRef,
  PeritoAuthorityRef,
} from './refs.js';
import { PeritoDesignated } from './perito-events.js';
import { peritoEntityInvariants, PERITO_INVARIANTS_MANIFEST } from './perito-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const PERITO_UUID = '00000000-0000-4000-8000-000000000111';
const PERSON_UUID = '00000000-0000-4000-8000-000000000112';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const PERICIA_UUID = '00000000-0000-4000-8000-0000000000d0';
const AUTH_UUID = '00000000-0000-4000-8000-000000000113';

function validInput(): PeritoDesignationInput {
  return {
    id: PeritoId.fromString(PERITO_UUID),
    person: PeritoPersonRef.fromString(PERSON_UUID),
    mission: PeritoMissionRef.fromString(MISSION_UUID),
    expertise: PeritoExpertiseRef.fromString(PERICIA_UUID),
    designatedBy: PeritoAuthorityRef.fromString(AUTH_UUID),
    designatedAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

describe('PeritoAggregate — designação (item 7; DF-12)', () => {
  it('designa uma Pessoa como Perito numa PERÍCIA e emite PeritoDesignated', () => {
    const result = PeritoAggregate.designate(validInput());
    expect(result.isOk()).toBe(true);
    const p = result.unwrap();
    expect(p.person.personId).toBe(PERSON_UUID);
    expect(p.mission.missionId).toBe(MISSION_UUID);
    expect(p.expertise.periciaId).toBe(PERICIA_UUID);
    expect(p.designatedBy.authorityId).toBe(AUTH_UUID);
    const events = p.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(PeritoDesignated);
    expect(events[0]?.eventName).toBe('perito.designated');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-14T12:00:00.000Z');
    expect(p.pullDomainEvents()).toHaveLength(0);
  });

  it('PT-PESSOA — sem Pessoa é recusada (item 1)', () => {
    // @ts-expect-error item 1: a Pessoa é obrigatória.
    const result = PeritoAggregate.designate({ ...validInput(), person: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PT-PESSOA');
  });

  it('INV-PT-03 — sem Missão é recusada (atua sobre uma missão)', () => {
    // @ts-expect-error INV-PT-03: a Missão é obrigatória.
    const result = PeritoAggregate.designate({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-PT-03');
  });

  it('PT-ATUA-NA-PERICIA — sem fase PERÍCIA é recusada (item 11/18)', () => {
    // @ts-expect-error item 11: a Perícia é obrigatória.
    const result = PeritoAggregate.designate({ ...validInput(), expertise: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PT-ATUA-NA-PERICIA');
  });

  it('PT-AUTORIZADO — sem autoridade designante é recusada (DF-12)', () => {
    // @ts-expect-error DF-12: a autoridade designante é obrigatória.
    const result = PeritoAggregate.designate({ ...validInput(), designatedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PT-AUTORIZADO');
  });

  it('PT-DATADO — datação inválida é recusada (Art. 14º)', () => {
    const result = PeritoAggregate.designate({ ...validInput(), designatedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PT-DATADO');
  });
});

describe('PeritoAggregate — identidade', () => {
  it('mesma PeritoId => igual; ids diferentes => diferentes', () => {
    const a = PeritoAggregate.designate(validInput()).unwrap();
    const b = PeritoAggregate.designate(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = PeritoAggregate.designate({
      ...validInput(),
      id: PeritoId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('PeritoAggregate — estrutura: não é a Perícia, não faz advocacia, não produz prova/verdade (INV-PT-01/02/03; itens 13/17)', () => {
  it('não expõe execução de perícia, produção de prova, advocacia, decisão, titularidade nem "ser etapa"', () => {
    const p = PeritoAggregate.designate(validInput()).unwrap();
    for (const forbidden of [
      'stage',
      'etapa',
      'isPericia',
      'specializedStage',
      'produceProof',
      'produzirProva',
      'executeProof',
      'executePericia',
      'decideJuridical',
      'advocacy',
      'advocacia',
      'sign',
      'assinar',
      'titularity',
      'titularidade',
      'createTruth',
    ]) {
      expect(forbidden in p).toBe(false);
    }
  });
});

describe('PeritoAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Perito designado satisfaz as invariantes de entidade', () => {
    const p = PeritoAggregate.designate(validInput()).unwrap();
    const result = InvariantsEngine.enforce(p, peritoEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('PeritoAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-PT-01..INV-PT-03, sem lacunas nem duplicatas', () => {
    const ids = PERITO_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-PT-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('INV-PT-01 é cross-entity (exclusividade sistêmica); INV-PT-02/03 são entity', () => {
    const byId = new Map(PERITO_INVARIANTS_MANIFEST.map((s) => [s.id, s.enforcement]));
    expect(byId.get('INV-PT-01')).toBe('cross-entity');
    expect(byId.get('INV-PT-02')).toBe('entity');
    expect(byId.get('INV-PT-03')).toBe('entity');
  });
});
