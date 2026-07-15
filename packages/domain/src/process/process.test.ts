// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade PROCESSO — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ProcessAggregate } from './process.js';
import type { ProcessRecognitionInput } from './process.js';
import { ProcessId } from './process-id.js';
import { ProcessMissionRef, ProcessCaseRef, ProcessResponsibleRef } from './refs.js';
import { ProcessRecognized } from './process-events.js';
import { processEntityInvariants, PROCESS_INVARIANTS_MANIFEST } from './process-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const PROCESS_UUID = '00000000-0000-4000-8000-000000000061';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const CASE_UUID = '00000000-0000-4000-8000-000000000051';
const RESP_UUID = '00000000-0000-4000-8000-0000000000b2';

function validInput(): ProcessRecognitionInput {
  return {
    id: ProcessId.fromString(PROCESS_UUID),
    mission: ProcessMissionRef.fromString(MISSION_UUID),
    legalFoundation: 'Ação revisional; CDC art. 51; contrato de financiamento',
    derivesFromCase: ProcessCaseRef.fromString(CASE_UUID),
    recognizedAt: new Date('2026-07-13T12:00:00.000Z'),
    recognizedBy: ProcessResponsibleRef.fromString(RESP_UUID),
  };
}

describe('ProcessAggregate — reconhecimento (Lei do Reconhecimento; DF-10)', () => {
  it('reconhece um Processo bem constituído (com Caso) e emite ProcessRecognized', () => {
    const result = ProcessAggregate.recognize(validInput());
    expect(result.isOk()).toBe(true);
    const p = result.unwrap();
    expect(p.mission.missionId).toBe(MISSION_UUID);
    expect(p.legalFoundation.value).toBe('Ação revisional; CDC art. 51; contrato de financiamento');
    expect(p.derivesFromCase?.caseId).toBe(CASE_UUID);
    const events = p.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProcessRecognized);
    expect(events[0]?.eventName).toBe('process.recognized');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(p.pullDomainEvents()).toHaveLength(0);
  });

  it('reconhece um Processo sem Caso (o vínculo com Caso é opcional — item 14/18)', () => {
    const { derivesFromCase: _omit, ...withoutCase } = validInput();
    void _omit;
    const result = ProcessAggregate.recognize(withoutCase);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().derivesFromCase).toBeNull();
  });

  it('INV-PR-01 — Processo sem Missão é recusado (não existe Processo fora de Missão; DF-10)', () => {
    // @ts-expect-error INV-PR-01/DF-10: a Missão é obrigatória.
    const result = ProcessAggregate.recognize({ ...validInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-PR-01');
  });

  it('PROCESSO-BEM-CONSTITUIDO — fundamento jurídico ausente é recusado (item 19; DF-01)', () => {
    const result = ProcessAggregate.recognize({ ...validInput(), legalFoundation: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PROCESSO-BEM-CONSTITUIDO');
  });

  it('rastreabilidade — responsável autorizado é obrigatório (DF-09; Art. 14º)', () => {
    // @ts-expect-error DF-09/Art. 14º: responsável é obrigatório.
    const result = ProcessAggregate.recognize({ ...validInput(), recognizedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PROCESSO-RASTREABILIDADE');
  });

  it('rastreabilidade — momento inválido é recusado (Art. 14º)', () => {
    const result = ProcessAggregate.recognize({ ...validInput(), recognizedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('PROCESSO-RASTREABILIDADE');
  });
});

describe('ProcessAggregate — identidade', () => {
  it('mesma ProcessId => igual; ids diferentes => diferentes', () => {
    const a = ProcessAggregate.recognize(validInput()).unwrap();
    const b = ProcessAggregate.recognize(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = ProcessAggregate.recognize({
      ...validInput(),
      id: ProcessId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('ProcessAggregate — estrutura: nunca é a missão, não decide, não modela fase (INV-PR-02; itens 13/16)', () => {
  it('não expõe estado/Verdade da missão, decisão jurídica, fase nem workflow', () => {
    const p = ProcessAggregate.recognize(validInput()).unwrap();
    for (const forbidden of [
      'state',
      'estado',
      'truth',
      'verdade',
      'decide',
      'decision',
      'phase',
      'fase',
      'workflow',
      'advance',
    ]) {
      expect(forbidden in p).toBe(false);
    }
  });
});

describe('ProcessAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Processo reconhecido satisfaz as invariantes de nível de entidade', () => {
    const p = ProcessAggregate.recognize(validInput()).unwrap();
    const result = InvariantsEngine.enforce(p, processEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('ProcessAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-PR-01..INV-PR-03, sem lacunas nem duplicatas', () => {
    const ids = PROCESS_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-PR-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });
});
