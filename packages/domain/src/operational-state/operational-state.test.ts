// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade ESTADO OPERACIONAL — unitários + invariantes. Cada teste
// cita a norma do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { OperationalStateAggregate } from './operational-state.js';
import type { OperationalStateDerivationInput } from './operational-state.js';
import { OperationalStateId } from './operational-state-id.js';
import { OperationalStateMissionRef, DerivedFromTruthRef } from './refs.js';
import { OperationalStateDerived } from './operational-state-events.js';
import {
  operationalStateEntityInvariants,
  OPERATIONAL_STATE_INVARIANTS_MANIFEST,
} from './operational-state-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const STATE_UUID = '00000000-0000-4000-8000-000000000081';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const TRUTH_UUID = '00000000-0000-4000-8000-000000000071';

function validInput(): OperationalStateDerivationInput {
  return {
    id: OperationalStateId.fromString(STATE_UUID),
    mission: OperationalStateMissionRef.fromString(MISSION_UUID),
    derivedFromTruth: DerivedFromTruthRef.fromString(TRUTH_UUID),
    derivedAt: new Date('2026-07-13T12:00:00.000Z'),
  };
}

describe('OperationalStateAggregate — derivação (item 7; INV-EO-02)', () => {
  it('deriva um Estado em curso (sem terminalidade) e emite OperationalStateDerived', () => {
    const result = OperationalStateAggregate.derive(validInput());
    expect(result.isOk()).toBe(true);
    const s = result.unwrap();
    expect(s.mission.missionId).toBe(MISSION_UUID);
    expect(s.derivedFromTruth.truthId).toBe(TRUTH_UUID);
    expect(s.terminalState).toBeNull();
    expect(s.isTerminal).toBe(false);
    const events = s.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OperationalStateDerived);
    expect(events[0]?.eventName).toBe('operational-state.derived');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(s.pullDomainEvents()).toHaveLength(0);
  });

  it('deriva um Estado terminal CONCLUÍDA (DF-11)', () => {
    const result = OperationalStateAggregate.derive({ ...validInput(), terminalState: 'CONCLUIDA' });
    expect(result.isOk()).toBe(true);
    const s = result.unwrap();
    expect(s.isTerminal).toBe(true);
    expect(s.terminalState?.isConcluded()).toBe(true);
  });

  it('deriva um Estado terminal ENCERRADA (DF-11)', () => {
    const result = OperationalStateAggregate.derive({ ...validInput(), terminalState: 'ENCERRADA' });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().terminalState?.isClosed()).toBe(true);
  });

  it('EO-ESTADO-TERMINAL — terminal fora do conjunto {CONCLUÍDA, ENCERRADA} é recusado (DF-11)', () => {
    // @ts-expect-error DF-11: não há terceiro estado terminal.
    const result = OperationalStateAggregate.derive({ ...validInput(), terminalState: 'ARQUIVADA' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('EO-ESTADO-TERMINAL');
  });

  it('INV-EO-02 — Estado sem Verdade de origem é recusado (deriva só da Verdade; DF-08)', () => {
    // @ts-expect-error INV-EO-02: a Verdade de origem é obrigatória.
    const result = OperationalStateAggregate.derive({ ...validInput(), derivedFromTruth: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-EO-02');
  });

  it('EO-POR-MISSAO — Estado sem Missão é recusado (Lei 2)', () => {
    // @ts-expect-error Lei 2: a Missão é obrigatória.
    const result = OperationalStateAggregate.derive({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('EO-POR-MISSAO');
  });

  it('EO-DATADO — datação inválida é recusada', () => {
    const result = OperationalStateAggregate.derive({ ...validInput(), derivedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('EO-DATADO');
  });
});

describe('OperationalStateAggregate — identidade', () => {
  it('mesma OperationalStateId => igual; ids diferentes => diferentes', () => {
    const a = OperationalStateAggregate.derive(validInput()).unwrap();
    const b = OperationalStateAggregate.derive(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = OperationalStateAggregate.derive({
      ...validInput(),
      id: OperationalStateId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('OperationalStateAggregate — estrutura: não é fonte autônoma, não recalcula, não é Etapa (item 16; INV-EO-04)', () => {
  it('não expõe recálculo, alteração por interface, representação visual nem decisão', () => {
    const s = OperationalStateAggregate.derive(validInput()).unwrap();
    for (const forbidden of [
      'recalculate',
      'recalcular',
      'setState',
      'alterState',
      'mutate',
      'visual',
      'representation',
      'etapa',
      'stage',
      'dashboard',
      'decide',
      'truth',
    ]) {
      expect(forbidden in s).toBe(false);
    }
  });
});

describe('OperationalStateAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Estado derivado satisfaz as invariantes de nível de entidade', () => {
    const s = OperationalStateAggregate.derive(validInput()).unwrap();
    const result = InvariantsEngine.enforce(s, operationalStateEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('OperationalStateAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-EO-01..INV-EO-04, sem lacunas nem duplicatas', () => {
    const ids = OPERATIONAL_STATE_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    for (let n = 1; n <= 4; n += 1) {
      const id = `INV-EO-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('INV-EO-02 é a única de locus entity; as demais são sistêmicas', () => {
    const byId = new Map(OPERATIONAL_STATE_INVARIANTS_MANIFEST.map((s) => [s.id, s.enforcement]));
    expect(byId.get('INV-EO-02')).toBe('entity');
    expect(byId.get('INV-EO-01')).not.toBe('entity');
    expect(byId.get('INV-EO-03')).not.toBe('entity');
    expect(byId.get('INV-EO-04')).not.toBe('entity');
  });
});
