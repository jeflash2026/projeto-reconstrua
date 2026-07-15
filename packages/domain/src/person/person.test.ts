// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade PESSOA — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { Person } from './person.js';
import type { PersonRecognitionInput } from './person.js';
import { PersonId } from './person-id.js';
import { RecognitionResponsibleRef, EvidenceRef } from './refs.js';
import { PersonRecognized } from './person-events.js';
import { personEntityInvariants, PERSON_INVARIANTS_MANIFEST } from './person-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const PERSON_UUID = '00000000-0000-4000-8000-000000000021';
const RESP_UUID = '00000000-0000-4000-8000-0000000000c4';
const EVID_UUID = '00000000-0000-4000-8000-0000000000d5';

function validInput(): PersonRecognitionInput {
  return {
    id: PersonId.fromString(PERSON_UUID),
    civilIdentityText: 'Maria da Silva — RG/CPF suficientes para individualização.',
    originText: 'atendimento_humano',
    recognizedAt: new Date('2026-07-13T12:00:00.000Z'),
    responsible: RecognitionResponsibleRef.fromString(RESP_UUID),
    evidences: [EvidenceRef.fromString(EVID_UUID)],
  };
}

describe('Person — reconhecimento (DF-23; Lei do Reconhecimento)', () => {
  it('reconhece com os seis elementos e emite PersonRecognized', () => {
    const result = Person.recognize(validInput());
    expect(result.isOk()).toBe(true);

    const person = result.unwrap();
    const events = person.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(PersonRecognized);
    expect(events[0]?.eventName).toBe('person.recognized');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(person.pullDomainEvents()).toHaveLength(0);
  });

  it('INV-P14 — identidade civil vazia impede o reconhecimento', () => {
    const result = Person.recognize({ ...validInput(), civilIdentityText: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-P14');
  });

  it('INV-P14 — origem vazia impede o reconhecimento', () => {
    const result = Person.recognize({ ...validInput(), originText: '' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-P14');
  });

  it('INV-P14 — data de reconhecimento inválida impede o reconhecimento', () => {
    const result = Person.recognize({ ...validInput(), recognizedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-P14');
  });

  it('INV-P14 — sem evidências impede o reconhecimento (DF-23, elemento 6)', () => {
    const result = Person.recognize({ ...validInput(), evidences: [] });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-P14');
  });

  it('INV-P14 — responsável é obrigatório (tipo e runtime)', () => {
    // @ts-expect-error DF-23: responsável é obrigatório (garantia de tipo).
    const result = Person.recognize({ ...validInput(), responsible: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-P14');
  });
});

describe('Person — identidade permanente (INV-P01/INV-P02)', () => {
  it('mesma PersonId => igual; ids diferentes => diferentes', () => {
    const a = Person.recognize(validInput()).unwrap();
    const b = Person.recognize(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = Person.recognize({
      ...validInput(),
      id: PersonId.fromString('00000000-0000-4000-8000-0000000000ee'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('Person — estrutura proíbe estado (INV-P03) e encerramento (INV-P13)', () => {
  it('a Pessoa não expõe estado, etapa, workflow, timeline nem missões', () => {
    const person = Person.recognize(validInput()).unwrap();
    for (const forbidden of ['state', 'etapa', 'workflow', 'timeline', 'missions', 'estado']) {
      expect(forbidden in person).toBe(false);
    }
  });
});

describe('Person — invariantes de entidade (InvariantsEngine)', () => {
  it('uma Pessoa reconhecida satisfaz as invariantes de nível de entidade', () => {
    const person = Person.recognize(validInput()).unwrap();
    const result = InvariantsEngine.enforce(person, personEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('Person — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-P01..INV-P15, sem lacunas nem duplicatas', () => {
    const ids = PERSON_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(15);
    for (let n = 1; n <= 15; n += 1) {
      const id = `INV-P${String(n).padStart(2, '0')}`;
      expect(ids).toContain(id);
    }
  });
});
