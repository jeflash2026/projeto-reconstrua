// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade CLIENTE — unitários + invariantes. Cada teste cita a norma do
// Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ClienteAggregate } from './cliente.js';
import type { ClienteRecognitionInput } from './cliente.js';
import { ClienteId } from './cliente-id.js';
import { ClientePersonRef, ClienteRecognitionResponsibleRef } from './refs.js';
import { ClienteRecognized } from './cliente-events.js';
import { clienteEntityInvariants, CLIENTE_INVARIANTS_MANIFEST } from './cliente-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const CLIENTE_UUID = '00000000-0000-4000-8000-000000000141';
const PERSON_UUID = '00000000-0000-4000-8000-000000000142';
const RESP_UUID = '00000000-0000-4000-8000-000000000143';

function validInput(): ClienteRecognitionInput {
  return {
    id: ClienteId.fromString(CLIENTE_UUID),
    person: ClientePersonRef.fromString(PERSON_UUID),
    recognizedBy: ClienteRecognitionResponsibleRef.fromString(RESP_UUID),
    recognizedAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

describe('ClienteAggregate — reconhecimento da condição (item 7; DF-23)', () => {
  it('reconhece a condição de Cliente de uma Pessoa e emite ClienteRecognized', () => {
    const result = ClienteAggregate.recognize(validInput());
    expect(result.isOk()).toBe(true);
    const c = result.unwrap();
    expect(c.person.personId).toBe(PERSON_UUID);
    expect(c.recognizedBy.responsibleId).toBe(RESP_UUID);
    const events = c.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ClienteRecognized);
    expect(events[0]?.eventName).toBe('cliente.recognized');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-14T12:00:00.000Z');
    expect(c.pullDomainEvents()).toHaveLength(0);
  });

  it('INV-CL-01 — sem Pessoa é recusada (todo cliente é uma Pessoa reconhecida)', () => {
    // @ts-expect-error INV-CL-01: a Pessoa é obrigatória.
    const result = ClienteAggregate.recognize({ ...validInput(), person: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-CL-01');
  });

  it('CL-RASTREAVEL — sem responsável é recusada (item 7/8; DF-12)', () => {
    // @ts-expect-error item 7/8: o responsável é obrigatório.
    const result = ClienteAggregate.recognize({ ...validInput(), recognizedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('CL-RASTREAVEL');
  });

  it('CL-RASTREAVEL — datação inválida é recusada (Art. 14º)', () => {
    const result = ClienteAggregate.recognize({ ...validInput(), recognizedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('CL-RASTREAVEL');
  });
});

describe('ClienteAggregate — identidade', () => {
  it('mesma ClienteId => igual; ids diferentes => diferentes', () => {
    const a = ClienteAggregate.recognize(validInput()).unwrap();
    const b = ClienteAggregate.recognize(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = ClienteAggregate.recognize({
      ...validInput(),
      id: ClienteId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('ClienteAggregate — estrutura: é condição, não Pessoa/ator (INV-CL-02/03; itens 4/13)', () => {
  it('não expõe criação/duplicação/alteração de Pessoa, alteração de estado/verdade, decisão, condução nem posse', () => {
    const c = ClienteAggregate.recognize(validInput()).unwrap();
    for (const forbidden of [
      'createPerson',
      'criarPessoa',
      'duplicatePerson',
      'alterCivilIdentity',
      'alterarIdentidade',
      'alterState',
      'createTruth',
      'decideJuridical',
      'conductOperation',
      'produceProof',
      'ownPerson',
      'ownMission',
    ]) {
      expect(forbidden in c).toBe(false);
    }
  });
});

describe('ClienteAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Cliente reconhecido satisfaz as invariantes de entidade', () => {
    const c = ClienteAggregate.recognize(validInput()).unwrap();
    const result = InvariantsEngine.enforce(c, clienteEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('ClienteAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-CL-01..INV-CL-03, sem lacunas nem duplicatas', () => {
    const ids = CLIENTE_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (let n = 1; n <= 3; n += 1) {
      const id = `INV-CL-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });

  it('as três invariantes são de locus entity (condição garantida por referência e por ausência)', () => {
    for (const spec of CLIENTE_INVARIANTS_MANIFEST) {
      expect(spec.enforcement).toBe('entity');
    }
  });
});
