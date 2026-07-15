// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade PROJEÇÃO — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ProjectionAggregate } from './projection.js';
import type { ProjectionDerivationInput } from './projection.js';
import { ProjectionId } from './projection-id.js';
import { ProjectionTruthRef } from './refs.js';
import { ProjectionDerived } from './projection-events.js';
import {
  projectionEntityInvariants,
  PROJECTION_INVARIANTS_MANIFEST,
} from './projection-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const PROJECTION_UUID = '00000000-0000-4000-8000-0000000000a0';
const TRUTH_UUID = '00000000-0000-4000-8000-000000000071';

function validInput(): ProjectionDerivationInput {
  return {
    id: ProjectionId.fromString(PROJECTION_UUID),
    derivedFromTruth: ProjectionTruthRef.fromString(TRUTH_UUID),
    reading: 'Indicador: 3 missões na fase de análise',
    calculatedAt: new Date('2026-07-13T12:00:00.000Z'),
  };
}

describe('ProjectionAggregate — derivação (item 1; INV-PJ-01)', () => {
  it('deriva uma leitura da Verdade e emite ProjectionDerived', () => {
    const result = ProjectionAggregate.derive(validInput());
    expect(result.isOk()).toBe(true);
    const p = result.unwrap();
    expect(p.derivedFromTruth.truthId).toBe(TRUTH_UUID);
    expect(p.reading.value).toBe('Indicador: 3 missões na fase de análise');
    const events = p.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProjectionDerived);
    expect(events[0]?.eventName).toBe('projection.derived');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(p.pullDomainEvents()).toHaveLength(0);
  });

  it('INV-PJ-01 — Projeção sem Verdade de origem é recusada (deriva só da Verdade; DF-03)', () => {
    // @ts-expect-error INV-PJ-01: a Verdade de origem é obrigatória.
    const result = ProjectionAggregate.derive({ ...validInput(), derivedFromTruth: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-PJ-01');
  });

  it('PJ-LEITURA-DERIVADA — Projeção sem leitura é recusada (itens 3/19)', () => {
    const result = ProjectionAggregate.derive({ ...validInput(), reading: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PJ-LEITURA-DERIVADA');
  });

  it('PJ-DATADA — datação inválida é recusada', () => {
    const result = ProjectionAggregate.derive({ ...validInput(), calculatedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PJ-DATADA');
  });
});

describe('ProjectionAggregate — identidade', () => {
  it('mesma ProjectionId => igual; ids diferentes => diferentes', () => {
    const a = ProjectionAggregate.derive(validInput()).unwrap();
    const b = ProjectionAggregate.derive(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = ProjectionAggregate.derive({
      ...validInput(),
      id: ProjectionId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('ProjectionAggregate — estrutura: nunca altera Verdade/Estado/Etapa, nunca decide (INV-PJ-01/02; itens 16/17)', () => {
  it('não expõe mutação de verdade/estado/etapa, decisão nem apresentação como verdade', () => {
    const p = ProjectionAggregate.derive(validInput()).unwrap();
    for (const forbidden of [
      'state',
      'estado',
      'stage',
      'etapa',
      'alterTruth',
      'recalculateTruth',
      'substitute',
      'setState',
      'alterState',
      'mutate',
      'decide',
      'decision',
    ]) {
      expect(forbidden in p).toBe(false);
    }
  });
});

describe('ProjectionAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('uma Projeção derivada satisfaz as invariantes de nível de entidade', () => {
    const p = ProjectionAggregate.derive(validInput()).unwrap();
    const result = InvariantsEngine.enforce(p, projectionEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('ProjectionAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-PJ-01..INV-PJ-02, sem lacunas nem duplicatas', () => {
    const ids = PROJECTION_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain('INV-PJ-01');
    expect(ids).toContain('INV-PJ-02');
  });

  it('ambas as invariantes são de locus entity (a Projeção as garante por referência e por ausência)', () => {
    for (const spec of PROJECTION_INVARIANTS_MANIFEST) {
      expect(spec.enforcement).toBe('entity');
    }
  });
});
