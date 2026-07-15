// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade CASO — unitários + invariantes. Cada teste cita a norma do
// Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { CaseAggregate } from './case.js';
import type { CaseRecognitionInput } from './case.js';
import { CaseId } from './case-id.js';
import { CaseMissionRef, CaseResponsibleRef } from './refs.js';
import { CaseRecognized } from './case-events.js';
import { caseEntityInvariants, CASE_INVARIANTS_MANIFEST } from './case-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const CASE_UUID = '00000000-0000-4000-8000-000000000051';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const RESP_UUID = '00000000-0000-4000-8000-0000000000b2';

function validInput(): CaseRecognitionInput {
  return {
    id: CaseId.fromString(CASE_UUID),
    mission: CaseMissionRef.fromString(MISSION_UUID),
    legalContext: 'Revisão de contrato de financiamento X',
    legalFoundation: 'Cobrança de encargos abusivos; CDC art. 51',
    recognizedAt: new Date('2026-07-13T12:00:00.000Z'),
    recognizedBy: CaseResponsibleRef.fromString(RESP_UUID),
  };
}

describe('CaseAggregate — reconhecimento (princípio: reconhecido, nunca inventado)', () => {
  it('reconhece um Caso bem formado e emite CaseRecognized', () => {
    const result = CaseAggregate.recognize(validInput());
    expect(result.isOk()).toBe(true);
    const c = result.unwrap();
    expect(c.legalContext.value).toBe('Revisão de contrato de financiamento X');
    expect(c.legalFoundation.value).toBe('Cobrança de encargos abusivos; CDC art. 51');
    expect(c.mission.missionId).toBe(MISSION_UUID);
    const events = c.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CaseRecognized);
    expect(events[0]?.eventName).toBe('case.recognized');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(c.pullDomainEvents()).toHaveLength(0);
  });

  it('INV-CA-01 — Caso sem Missão é recusado (não existe Caso fora de Missão; DF-08)', () => {
    // @ts-expect-error INV-CA-01/DF-08: a Missão é obrigatória.
    const result = CaseAggregate.recognize({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-CA-01');
  });

  it('CASO-BEM-FORMADO — contexto jurídico ausente é recusado (item 19)', () => {
    const result = CaseAggregate.recognize({ ...validInput(), legalContext: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('CASO-BEM-FORMADO');
  });

  it('CASO-BEM-FORMADO — fundamento jurídico ausente é recusado (DF-01)', () => {
    const result = CaseAggregate.recognize({ ...validInput(), legalFoundation: '' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('CASO-BEM-FORMADO');
  });

  it('rastreabilidade — responsável autorizado é obrigatório (DF-12; Art. 14º)', () => {
    // @ts-expect-error Art. 14º/DF-12: responsável é obrigatório.
    const result = CaseAggregate.recognize({ ...validInput(), recognizedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('CASO-RASTREABILIDADE');
  });

  it('rastreabilidade — momento inválido é recusado (Art. 14º)', () => {
    const result = CaseAggregate.recognize({ ...validInput(), recognizedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('CASO-RASTREABILIDADE');
  });
});

describe('CaseAggregate — identidade', () => {
  it('mesma CaseId => igual; ids diferentes => diferentes', () => {
    const a = CaseAggregate.recognize(validInput()).unwrap();
    const b = CaseAggregate.recognize(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = CaseAggregate.recognize({
      ...validInput(),
      id: CaseId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('CaseAggregate — estrutura proíbe processo/estado/decisão (INV-CA-02; itens 13/16)', () => {
  it('não expõe processo, estado, Verdade, decisão nem workflow', () => {
    const c = CaseAggregate.recognize(validInput()).unwrap();
    for (const forbidden of [
      'process',
      'processo',
      'state',
      'estado',
      'truth',
      'verdade',
      'decide',
      'decision',
      'workflow',
      'advance',
    ]) {
      expect(forbidden in c).toBe(false);
    }
  });
});

describe('CaseAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Caso reconhecido satisfaz as invariantes de nível de entidade', () => {
    const c = CaseAggregate.recognize(validInput()).unwrap();
    const result = InvariantsEngine.enforce(c, caseEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('CaseAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-CA-01..INV-CA-03, sem lacunas nem duplicatas', () => {
    const ids = CASE_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-CA-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });
});
