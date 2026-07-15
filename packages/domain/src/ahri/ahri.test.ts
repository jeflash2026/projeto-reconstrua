// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade AHRI — unitários + invariantes. Cada teste cita a norma do
// Livro Mestre que verifica. Puro (sem infraestrutura). Ênfase na salvaguarda
// IA×humano (DF-09; INV-AH-01/03/04).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { AhriAggregate } from './ahri.js';
import type { AhriResponsibilityInput } from './ahri.js';
import { AhriId } from './ahri-id.js';
import { AhriMissionRef, GoverningRuleRef } from './refs.js';
import { AhriOperationalResponsibilityAssumed } from './ahri-events.js';
import { AHRI_DECISOR, AHRI_DECISION_TYPE } from './value-objects.js';
import { ahriEntityInvariants, AHRI_INVARIANTS_MANIFEST } from './ahri-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const AHRI_UUID = '00000000-0000-4000-8000-0000000000f0';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const RULE_UUID = '00000000-0000-4000-8000-0000000000c0';

function validInput(): AhriResponsibilityInput {
  return {
    id: AhriId.fromString(AHRI_UUID),
    mission: AhriMissionRef.fromString(MISSION_UUID),
    governingRule: GoverningRuleRef.fromString(RULE_UUID),
    fundamento: 'Regra Constitucional DF-09 + Regra Operacional RO-R8-001',
    assumedAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

describe('AhriAggregate — assunção de responsabilidade operacional (DF-09; INV-AH-02)', () => {
  it('assume responsabilidade e emite AhriOperationalResponsibilityAssumed com registro DF-09', () => {
    const result = AhriAggregate.assumeOperationalResponsibility(validInput());
    expect(result.isOk()).toBe(true);
    const a = result.unwrap();
    expect(a.mission.missionId).toBe(MISSION_UUID);
    expect(a.governingRule.ruleId).toBe(RULE_UUID);
    expect(a.record.decisor).toBe(AHRI_DECISOR);
    expect(a.record.tipo).toBe(AHRI_DECISION_TYPE);
    expect(a.record.fundamento).toContain('RO-R8-001');
    const events = a.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(AhriOperationalResponsibilityAssumed);
    expect(events[0]?.eventName).toBe('ahri.operational-responsibility-assumed');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-14T12:00:00.000Z');
    expect(a.pullDomainEvents()).toHaveLength(0);
  });

  it('AH-DE-MISSAO — sem Missão é recusada (item 12)', () => {
    // @ts-expect-error item 12: a Missão é obrigatória.
    const result = AhriAggregate.assumeOperationalResponsibility({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('AH-DE-MISSAO');
  });

  it('INV-AH-02 — sem Regra Operacional de fundamento é recusada (DF-09)', () => {
    // @ts-expect-error INV-AH-02: a Regra Operacional é obrigatória.
    const result = AhriAggregate.assumeOperationalResponsibility({ ...validInput(), governingRule: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-AH-02');
  });

  it('INV-AH-02 — sem FUNDAMENTO citado é recusada (registro DF-09)', () => {
    const result = AhriAggregate.assumeOperationalResponsibility({ ...validInput(), fundamento: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-AH-02');
  });

  it('AH-AUDITAVEL — datação inválida é recusada (Lei 4; Art. 14º)', () => {
    const result = AhriAggregate.assumeOperationalResponsibility({ ...validInput(), assumedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('AH-AUDITAVEL');
  });
});

describe('AhriAggregate — identidade', () => {
  it('mesma AhriId => igual; ids diferentes => diferentes', () => {
    const a = AhriAggregate.assumeOperationalResponsibility(validInput()).unwrap();
    const b = AhriAggregate.assumeOperationalResponsibility(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = AhriAggregate.assumeOperationalResponsibility({
      ...validInput(),
      id: AhriId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('AhriAggregate — SALVAGUARDA IA×humano: jamais decide/privativo/cria verdade (DF-09; INV-AH-01/03/04)', () => {
  it('não expõe decisão, ato privativo, assinatura, parecer nem criação de fato/verdade', () => {
    const a = AhriAggregate.assumeOperationalResponsibility(validInput()).unwrap();
    for (const forbidden of [
      'decide',
      'decision',
      'finalDecision',
      'decideJuridical',
      'sign',
      'assinar',
      'parecer',
      'privativeAct',
      'atoPrivativo',
      'createTruth',
      'criarVerdade',
      'createFact',
      'criarFato',
      'createEvidence',
      'substituteHuman',
    ]) {
      expect(forbidden in a).toBe(false);
    }
  });
});

describe('AhriAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('uma AHRI que assumiu responsabilidade satisfaz as invariantes de entidade', () => {
    const a = AhriAggregate.assumeOperationalResponsibility(validInput()).unwrap();
    const result = InvariantsEngine.enforce(a, ahriEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('AhriAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-AH-01..INV-AH-04, sem lacunas nem duplicatas', () => {
    const ids = AHRI_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    for (let n = 1; n <= 4; n += 1) {
      const id = `INV-AH-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('as quatro invariantes são de locus entity (salvaguarda estrutural)', () => {
    for (const spec of AHRI_INVARIANTS_MANIFEST) {
      expect(spec.enforcement).toBe('entity');
    }
  });
});
