// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade OPERAÇÃO — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { OperationAggregate } from './operation.js';
import type { OperationConductInput } from './operation.js';
import { OperationId } from './operation-id.js';
import { OperationMissionRef, OperationResponsibleRef } from './refs.js';
import { OperationConducted } from './operation-events.js';
import {
  operationEntityInvariants,
  OPERATION_INVARIANTS_MANIFEST,
} from './operation-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const OPERATION_UUID = '00000000-0000-4000-8000-0000000000b0';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const RESP_UUID = '00000000-0000-4000-8000-0000000000b2';

function validInput(): OperationConductInput {
  return {
    id: OperationId.fromString(OPERATION_UUID),
    mission: OperationMissionRef.fromString(MISSION_UUID),
    conductedBy: OperationResponsibleRef.fromString(RESP_UUID),
    conductedAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

describe('OperationAggregate — condução (item 1; INV-OP-01)', () => {
  it('conduz uma Operação em função de uma Missão e emite OperationConducted', () => {
    const result = OperationAggregate.conduct(validInput());
    expect(result.isOk()).toBe(true);
    const o = result.unwrap();
    expect(o.mission.missionId).toBe(MISSION_UUID);
    expect(o.conductedBy.responsibleId).toBe(RESP_UUID);
    const events = o.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OperationConducted);
    expect(events[0]?.eventName).toBe('operation.conducted');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-14T12:00:00.000Z');
    expect(o.pullDomainEvents()).toHaveLength(0);
  });

  it('INV-OP-01 — Operação sem Missão é recusada (existe em função da missão; DF-08)', () => {
    // @ts-expect-error INV-OP-01: a Missão é obrigatória.
    const result = OperationAggregate.conduct({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-OP-01');
  });

  it('OP-AUDITAVEL — Operação sem responsável é recusada (INV-OP-03; R9; Art. 14º)', () => {
    // @ts-expect-error INV-OP-03: responsável é obrigatório.
    const result = OperationAggregate.conduct({ ...validInput(), conductedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('OP-AUDITAVEL');
  });

  it('OP-AUDITAVEL — datação inválida é recusada (auditabilidade)', () => {
    const result = OperationAggregate.conduct({ ...validInput(), conductedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('OP-AUDITAVEL');
  });
});

describe('OperationAggregate — identidade', () => {
  it('mesma OperationId => igual; ids diferentes => diferentes', () => {
    const a = OperationAggregate.conduct(validInput()).unwrap();
    const b = OperationAggregate.conduct(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = OperationAggregate.conduct({
      ...validInput(),
      id: OperationId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('OperationAggregate — estrutura: não altera Verdade/Estado, não decide, não substitui Processo/Caso (itens 4/12/13/16)', () => {
  it('não expõe agir autônomo, mutação de verdade/estado, decisão nem substituição', () => {
    const o = OperationAggregate.conduct(validInput()).unwrap();
    for (const forbidden of [
      'verdade',
      'truth',
      'state',
      'estado',
      'process',
      'processo',
      'case',
      'caso',
      'decide',
      'decision',
      'execute',
      'workflow',
      'substitute',
    ]) {
      expect(forbidden in o).toBe(false);
    }
  });
});

describe('OperationAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('uma Operação conduzida satisfaz as invariantes de nível de entidade', () => {
    const o = OperationAggregate.conduct(validInput()).unwrap();
    const result = InvariantsEngine.enforce(o, operationEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('OperationAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-OP-01..INV-OP-03, sem lacunas nem duplicatas', () => {
    const ids = OPERATION_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-OP-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('INV-OP-01 é a única de locus entity; as demais são sistêmicas', () => {
    const byId = new Map(OPERATION_INVARIANTS_MANIFEST.map((s) => [s.id, s.enforcement]));
    expect(byId.get('INV-OP-01')).toBe('entity');
    expect(byId.get('INV-OP-02')).not.toBe('entity');
    expect(byId.get('INV-OP-03')).not.toBe('entity');
  });
});
