// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade PERÍCIA — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { PericiaAggregate } from './pericia.js';
import type { PericiaFramingInput } from './pericia.js';
import { PericiaId } from './pericia-id.js';
import { PericiaMissionRef, SpecializedStageRef, PericiaPeritoRef } from './refs.js';
import { PericiaFramed } from './pericia-events.js';
import { periciaEntityInvariants, PERICIA_INVARIANTS_MANIFEST } from './pericia-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const PERICIA_UUID = '00000000-0000-4000-8000-0000000000d0';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const STAGE_UUID = '00000000-0000-4000-8000-000000000091';
const PERITO_UUID = '00000000-0000-4000-8000-0000000000e0';

function validInput(): PericiaFramingInput {
  return {
    id: PericiaId.fromString(PERICIA_UUID),
    mission: PericiaMissionRef.fromString(MISSION_UUID),
    specializedStage: SpecializedStageRef.fromString(STAGE_UUID),
    perito: PericiaPeritoRef.fromString(PERITO_UUID),
    framedAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

describe('PericiaAggregate — enquadramento (item 5/16; DF-17)', () => {
  it('enquadra a fase pericial como etapa especializada e emite PericiaFramed', () => {
    const result = PericiaAggregate.frame(validInput());
    expect(result.isOk()).toBe(true);
    const p = result.unwrap();
    expect(p.mission.missionId).toBe(MISSION_UUID);
    expect(p.specializedStage.stageId).toBe(STAGE_UUID);
    expect(p.perito.peritoId).toBe(PERITO_UUID);
    const events = p.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(PericiaFramed);
    expect(events[0]?.eventName).toBe('pericia.framed');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-14T12:00:00.000Z');
    expect(p.pullDomainEvents()).toHaveLength(0);
  });

  it('PE-DE-MISSAO — Perícia sem Missão é recusada (não existe perícia sem missão; INV-PE-03)', () => {
    // @ts-expect-error INV-PE-03/item 11: a Missão é obrigatória.
    const result = PericiaAggregate.frame({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PE-DE-MISSAO');
  });

  it('PE-ESPECIALIZA-ETAPA — Perícia sem Etapa especializada é recusada (é etapa; INV-PE-01)', () => {
    // @ts-expect-error INV-PE-01/item 3: a Etapa especializada é obrigatória.
    const result = PericiaAggregate.frame({ ...validInput(), specializedStage: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PE-ESPECIALIZA-ETAPA');
  });

  it('PE-PERITO-RESPONSAVEL — Perícia sem perito responsável é recusada (item 19)', () => {
    // @ts-expect-error item 19: perito responsável é obrigatório.
    const result = PericiaAggregate.frame({ ...validInput(), perito: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PE-PERITO-RESPONSAVEL');
  });

  it('PE-DATADA — datação inválida é recusada (item 7; Art. 14º)', () => {
    const result = PericiaAggregate.frame({ ...validInput(), framedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PE-DATADA');
  });
});

describe('PericiaAggregate — identidade', () => {
  it('mesma PericiaId => igual; ids diferentes => diferentes', () => {
    const a = PericiaAggregate.frame(validInput()).unwrap();
    const b = PericiaAggregate.frame(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = PericiaAggregate.frame({
      ...validInput(),
      id: PericiaId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('PericiaAggregate — estrutura: é etapa, não papel; não produz prova, não decide (INV-PE-01/02; itens 16/17)', () => {
  it('não expõe produção de prova, execução, decisão, interpretação nem papel humano', () => {
    const p = PericiaAggregate.frame(validInput()).unwrap();
    for (const forbidden of [
      'produceProof',
      'produzirProva',
      'executeProof',
      'execute',
      'decide',
      'decision',
      'interpret',
      'perform',
      'role',
      'papel',
      'alterState',
      'alterTruth',
    ]) {
      expect(forbidden in p).toBe(false);
    }
  });
});

describe('PericiaAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('uma Perícia enquadrada satisfaz as invariantes de nível de entidade', () => {
    const p = PericiaAggregate.frame(validInput()).unwrap();
    const result = InvariantsEngine.enforce(p, periciaEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('PericiaAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-PE-01..INV-PE-03, sem lacunas nem duplicatas', () => {
    const ids = PERICIA_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-PE-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('INV-PE-01 e INV-PE-02 são de locus entity (estruturais); INV-PE-03 é event-store', () => {
    const byId = new Map(PERICIA_INVARIANTS_MANIFEST.map((s) => [s.id, s.enforcement]));
    expect(byId.get('INV-PE-01')).toBe('entity');
    expect(byId.get('INV-PE-02')).toBe('entity');
    expect(byId.get('INV-PE-03')).not.toBe('entity');
  });
});
