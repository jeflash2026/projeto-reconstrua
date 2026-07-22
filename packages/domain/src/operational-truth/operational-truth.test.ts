// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade VERDADE OPERACIONAL — unitários + invariantes. Cada teste
// cita a norma do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { OperationalTruthAggregate } from './operational-truth.js';
import type { OperationalTruthSynthesisInput } from './operational-truth.js';
import { OperationalTruthId } from './operational-truth-id.js';
import { OperationalTruthMissionRef, SynthesisResponsibleRef } from './refs.js';
import { OperationalTruthSynthesized } from './operational-truth-events.js';
import {
  operationalTruthEntityInvariants,
  OPERATIONAL_TRUTH_INVARIANTS_MANIFEST,
} from './operational-truth-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const TRUTH_UUID = '00000000-0000-4000-8000-000000000071';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const RESP_UUID = '00000000-0000-4000-8000-0000000000b2';

function validInput(): OperationalTruthSynthesisInput {
  return {
    id: OperationalTruthId.fromString(TRUTH_UUID),
    mission: OperationalTruthMissionRef.fromString(MISSION_UUID),
    chainJustification: 'Cadeia: Realidade→Dado→…→Conhecimento suficiente; síntese E8',
    synthesizedAt: new Date('2026-07-13T12:00:00.000Z'),
    synthesizedBy: SynthesisResponsibleRef.fromString(RESP_UUID),
  };
}

describe('OperationalTruthAggregate — síntese (E8; a Verdade nasce por síntese)', () => {
  it('sintetiza uma Verdade bem formada (sem incerteza) e emite OperationalTruthSynthesized', () => {
    const result = OperationalTruthAggregate.synthesize(validInput());
    expect(result.isOk()).toBe(true);
    const t = result.unwrap();
    expect(t.mission.missionId).toBe(MISSION_UUID);
    expect(t.chainJustification.value.length).toBeGreaterThan(0);
    expect(t.declaredUncertainty).toBeNull();
    const events = t.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OperationalTruthSynthesized);
    expect(events[0]?.eventName).toBe('operational-truth.synthesized');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(t.pullDomainEvents()).toHaveLength(0);
  });

  it('sintetiza uma Verdade com incerteza declarada (INV-E8-07)', () => {
    const result = OperationalTruthAggregate.synthesize({
      ...validInput(),
      declaredUncertainty: 'Conhecimento insuficiente sobre a data do fato gerador',
    });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().declaredUncertainty?.value).toContain('insuficiente');
  });

  it('VO-POR-MISSAO — Verdade sem Missão é recusada (Lei 2; item 1)', () => {
    // @ts-expect-error Lei 2/item 1: a Missão é obrigatória.
    const result = OperationalTruthAggregate.synthesize({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('VO-POR-MISSAO');
  });

  it('VO-CADEIA-DEMONSTRAVEL — Verdade sem cadeia demonstrável é recusada (INV-E8-02)', () => {
    const result = OperationalTruthAggregate.synthesize({
      ...validInput(),
      chainJustification: '   ',
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('VO-CADEIA-DEMONSTRAVEL');
  });

  it('VO-INCERTEZA-DECLARADA — incerteza declarada vazia é recusada (INV-E8-07: sem preenchimento artificial)', () => {
    const result = OperationalTruthAggregate.synthesize({
      ...validInput(),
      declaredUncertainty: '   ',
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('VO-INCERTEZA-DECLARADA');
  });

  it('VO-RASTREABILIDADE — responsável é obrigatório (INV-E8-06; DF-09; Art. 14º)', () => {
    const result = OperationalTruthAggregate.synthesize({
      ...validInput(),
      // @ts-expect-error INV-E8-06/DF-09: responsável é obrigatório.
      synthesizedBy: undefined,
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('VO-RASTREABILIDADE');
  });

  it('VO-RASTREABILIDADE — datação inválida é recusada (E8-L03)', () => {
    const result = OperationalTruthAggregate.synthesize({
      ...validInput(),
      synthesizedAt: new Date('x'),
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('VO-RASTREABILIDADE');
  });
});

describe('OperationalTruthAggregate — identidade', () => {
  it('mesma OperationalTruthId => igual; ids diferentes => diferentes', () => {
    const a = OperationalTruthAggregate.synthesize(validInput()).unwrap();
    const b = OperationalTruthAggregate.synthesize(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = OperationalTruthAggregate.synthesize({
      ...validInput(),
      id: OperationalTruthId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('OperationalTruthAggregate — estrutura: síntese sem estado/vigência/decisão/agregação (item 12/16; INV-VO-03/05)', () => {
  it('não expõe estado operacional, vigência mutável, conteúdo de Estado/Etapa, decisão nem métrica', () => {
    const t = OperationalTruthAggregate.synthesize(validInput()).unwrap();
    for (const forbidden of [
      'state',
      'estado',
      'isCurrent',
      'vigente',
      'current',
      'stage',
      'etapa',
      'decide',
      'decision',
      'aggregate',
      'metric',
      'kpi',
      'recalculate',
    ]) {
      expect(forbidden in t).toBe(false);
    }
  });
});

describe('OperationalTruthAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('uma Verdade sintetizada satisfaz as invariantes de boa-formação', () => {
    const t = OperationalTruthAggregate.synthesize(validInput()).unwrap();
    const result = InvariantsEngine.enforce(t, operationalTruthEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('OperationalTruthAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-VO-01..INV-VO-05, sem lacunas nem duplicatas', () => {
    const ids = OPERATIONAL_TRUTH_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    for (let n = 1; n <= 5; n += 1) {
      const id = `INV-VO-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('nenhuma INV-VO é de locus entity (todas sistêmicas: event-store/cross-entity/cqrs/projection)', () => {
    for (const spec of OPERATIONAL_TRUTH_INVARIANTS_MANIFEST) {
      expect(spec.enforcement).not.toBe('entity');
    }
  });
});
