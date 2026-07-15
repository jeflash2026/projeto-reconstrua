// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade REGRA OPERACIONAL — unitários + invariantes. Cada teste cita
// a norma do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { OperationalRuleAggregate } from './operational-rule.js';
import type { OperationalRuleApprovalInput } from './operational-rule.js';
import { OperationalRuleId } from './operational-rule-id.js';
import { ApprovalResponsibleRef } from './refs.js';
import { OperationalRuleApproved } from './operational-rule-events.js';
import {
  operationalRuleEntityInvariants,
  OPERATIONAL_RULE_INVARIANTS_MANIFEST,
} from './operational-rule-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const RULE_UUID = '00000000-0000-4000-8000-0000000000c0';
const RESP_UUID = '00000000-0000-4000-8000-0000000000b2';

function validInput(): OperationalRuleApprovalInput {
  return {
    id: OperationalRuleId.fromString(RULE_UUID),
    code: 'RO-R7-003',
    definition: {
      name: 'Acionar advogado ao aproximar-se de prazo',
      objective: 'Garantir atuação tempestiva do responsável jurídico',
      executionCriterion: 'Prazo processual a menos de 5 dias',
      blockingCriterion: 'Missão encerrada ou sem processo vinculado',
      inputEvent: 'prazo.aproximando',
      outputEvent: 'responsavel.acionado',
      producedEvidence: 'Registro de acionamento com carimbo de tempo',
    },
    approvedBy: ApprovalResponsibleRef.fromString(RESP_UUID),
    version: '1.0',
    canonFoundation: 'DF-09; R7; Art. 14º',
    approvedAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

describe('OperationalRuleAggregate — aprovação (DF-13; INV-RO-01)', () => {
  it('aprova uma Regra com os dez elementos + fundamento e emite OperationalRuleApproved', () => {
    const result = OperationalRuleAggregate.approve(validInput());
    expect(result.isOk()).toBe(true);
    const r = result.unwrap();
    expect(r.code.value).toBe('RO-R7-003');
    expect(r.hasTenElements()).toBe(true);
    expect(r.canonFoundation.value).toContain('DF-09');
    const events = r.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OperationalRuleApproved);
    expect(events[0]?.eventName).toBe('operational-rule.approved');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-14T12:00:00.000Z');
    expect(r.pullDomainEvents()).toHaveLength(0);
  });

  it('INV-RO-01 — sem identificador (elemento 1) é recusada', () => {
    const result = OperationalRuleAggregate.approve({ ...validInput(), code: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-RO-01');
  });

  it('INV-RO-01 — faltando um elemento da definição (2–8) é recusada', () => {
    const result = OperationalRuleAggregate.approve({
      ...validInput(),
      definition: { ...validInput().definition, blockingCriterion: '  ' },
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-RO-01');
  });

  it('INV-RO-01 — sem responsável pela aprovação (elemento 9) é recusada', () => {
    // @ts-expect-error DF-13 elemento 9: responsável é obrigatório.
    const result = OperationalRuleAggregate.approve({ ...validInput(), approvedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-RO-01');
  });

  it('INV-RO-01 — sem versão (elemento 10) é recusada', () => {
    const result = OperationalRuleAggregate.approve({ ...validInput(), version: '' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-RO-01');
  });

  it('RO-FUNDAMENTO-CITADO — sem fundamento superior citado é recusada (item 19; INV-RO-02)', () => {
    const result = OperationalRuleAggregate.approve({ ...validInput(), canonFoundation: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('RO-FUNDAMENTO-CITADO');
  });

  it('RO-AUDITAVEL — datação de aprovação inválida é recusada (Lei 4; Art. 14º)', () => {
    const result = OperationalRuleAggregate.approve({ ...validInput(), approvedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('RO-AUDITAVEL');
  });
});

describe('OperationalRuleAggregate — identidade', () => {
  it('mesma OperationalRuleId => igual; ids diferentes => diferentes', () => {
    const a = OperationalRuleAggregate.approve(validInput()).unwrap();
    const b = OperationalRuleAggregate.approve(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = OperationalRuleAggregate.approve({
      ...validInput(),
      id: OperationalRuleId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('OperationalRuleAggregate — estrutura: representa a existência, não executa (item 1/16; restrição do fundador)', () => {
  it('não expõe execução de regra, disparo de evento, decisão nem mutação de verdade/estado', () => {
    const r = OperationalRuleAggregate.approve(validInput()).unwrap();
    for (const forbidden of [
      'execute',
      'run',
      'evaluate',
      'apply',
      'trigger',
      'decide',
      'decision',
      'alterTruth',
      'alterState',
      'workflow',
    ]) {
      expect(forbidden in r).toBe(false);
    }
  });
});

describe('OperationalRuleAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('uma Regra aprovada satisfaz as invariantes de nível de entidade', () => {
    const r = OperationalRuleAggregate.approve(validInput()).unwrap();
    const result = InvariantsEngine.enforce(r, operationalRuleEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('OperationalRuleAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-RO-01..INV-RO-03, sem lacunas nem duplicatas', () => {
    const ids = OPERATIONAL_RULE_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-RO-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('INV-RO-01 é a única de locus entity; INV-RO-02/03 são cross-entity', () => {
    const byId = new Map(OPERATIONAL_RULE_INVARIANTS_MANIFEST.map((s) => [s.id, s.enforcement]));
    expect(byId.get('INV-RO-01')).toBe('entity');
    expect(byId.get('INV-RO-02')).not.toBe('entity');
    expect(byId.get('INV-RO-03')).not.toBe('entity');
  });
});
