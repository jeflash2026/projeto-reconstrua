// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade ETAPA OPERACIONAL — unitários + invariantes. Cada teste cita
// a norma do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { OperationalStageAggregate } from './operational-stage.js';
import type { OperationalStageRepresentationInput } from './operational-stage.js';
import { OperationalStageId } from './operational-stage-id.js';
import { RepresentedStateRef } from './refs.js';
import { OperationalStageRepresented } from './operational-stage-events.js';
import {
  operationalStageEntityInvariants,
  OPERATIONAL_STAGE_INVARIANTS_MANIFEST,
} from './operational-stage-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const STAGE_UUID = '00000000-0000-4000-8000-000000000091';
const STATE_UUID = '00000000-0000-4000-8000-000000000081';

function validInput(): OperationalStageRepresentationInput {
  return {
    id: OperationalStageId.fromString(STAGE_UUID),
    representedState: RepresentedStateRef.fromString(STATE_UUID),
    form: 'Em análise',
    presentedAt: new Date('2026-07-13T12:00:00.000Z'),
  };
}

describe('OperationalStageAggregate — representação (item 1; INV-ET-01)', () => {
  it('representa um Estado (1:1) e emite OperationalStageRepresented', () => {
    const result = OperationalStageAggregate.represent(validInput());
    expect(result.isOk()).toBe(true);
    const e = result.unwrap();
    expect(e.representedState.stateId).toBe(STATE_UUID);
    expect(e.form.value).toBe('Em análise');
    const events = e.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OperationalStageRepresented);
    expect(events[0]?.eventName).toBe('operational-stage.represented');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(e.pullDomainEvents()).toHaveLength(0);
  });

  it('INV-ET-01 — Etapa sem Estado representado é recusada (1:1 obrigatório)', () => {
    const result = OperationalStageAggregate.represent({
      ...validInput(),
      // @ts-expect-error INV-ET-01: o Estado representado é obrigatório.
      representedState: undefined,
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-ET-01');
  });

  it('ET-FORMA-APRESENTAVEL — Etapa sem forma apresentável é recusada (itens 2/3)', () => {
    const result = OperationalStageAggregate.represent({ ...validInput(), form: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('ET-FORMA-APRESENTAVEL');
  });

  it('ET-DATADA — datação inválida é recusada', () => {
    const result = OperationalStageAggregate.represent({
      ...validInput(),
      presentedAt: new Date('x'),
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('ET-DATADA');
  });
});

describe('OperationalStageAggregate — identidade', () => {
  it('mesma OperationalStageId => igual; ids diferentes => diferentes', () => {
    const a = OperationalStageAggregate.represent(validInput()).unwrap();
    const b = OperationalStageAggregate.represent(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = OperationalStageAggregate.represent({
      ...validInput(),
      id: OperationalStageId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('OperationalStageAggregate — estrutura: nunca altera nem é fonte (itens 16/17; INV-ET-02)', () => {
  it('não expõe mutação de estado, fonte de verdade/estado, recálculo nem decisão', () => {
    const e = OperationalStageAggregate.represent(validInput()).unwrap();
    for (const forbidden of [
      'setState',
      'alterState',
      'changeState',
      'mutate',
      'recalculate',
      'recalcular',
      'decide',
      'truth',
      'verdade',
      'synthesize',
      'evolve',
    ]) {
      expect(forbidden in e).toBe(false);
    }
  });
});

describe('OperationalStageAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('uma Etapa representada satisfaz as invariantes de nível de entidade', () => {
    const e = OperationalStageAggregate.represent(validInput()).unwrap();
    const result = InvariantsEngine.enforce(e, operationalStageEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('OperationalStageAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-ET-01..INV-ET-03, sem lacunas nem duplicatas', () => {
    const ids = OPERATIONAL_STAGE_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-ET-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('INV-ET-01 é a única de locus entity; as demais são sistêmicas', () => {
    const byId = new Map(OPERATIONAL_STAGE_INVARIANTS_MANIFEST.map((s) => [s.id, s.enforcement]));
    expect(byId.get('INV-ET-01')).toBe('entity');
    expect(byId.get('INV-ET-02')).not.toBe('entity');
    expect(byId.get('INV-ET-03')).not.toBe('entity');
  });
});
