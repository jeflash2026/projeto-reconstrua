// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade EVENTO — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { EventAggregate } from './event.js';
import type { EventRecognitionInput } from './event.js';
import { EventId } from './event-id.js';
import { EventMissionRef, FactRef, EventRecognitionResponsibleRef } from './refs.js';
import { EventRecognized } from './event-events.js';
import { eventEntityInvariants, EVENT_INVARIANTS_MANIFEST } from './event-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const EVENT_UUID = '00000000-0000-4000-8000-000000000041';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const FACT_UUID = '00000000-0000-4000-8000-0000000000c3';
const RESP_UUID = '00000000-0000-4000-8000-0000000000b2';

function relevantInput(): EventRecognitionInput {
  return {
    id: EventId.fromString(EVENT_UUID),
    classification: 'RELEVANT',
    mission: EventMissionRef.fromString(MISSION_UUID),
    fact: FactRef.fromString(FACT_UUID),
    occurredAt: new Date('2026-07-13T10:00:00.000Z'),
    recognizedAt: new Date('2026-07-13T12:00:00.000Z'),
    recognizedBy: EventRecognitionResponsibleRef.fromString(RESP_UUID),
  };
}

function informativeInput(): EventRecognitionInput {
  return {
    id: EventId.fromString(EVENT_UUID),
    classification: 'INFORMATIVE',
    mission: EventMissionRef.fromString(MISSION_UUID),
    occurredAt: new Date('2026-07-13T10:00:00.000Z'),
    recognizedAt: new Date('2026-07-13T12:00:00.000Z'),
    recognizedBy: EventRecognitionResponsibleRef.fromString(RESP_UUID),
  };
}

describe('EventAggregate — reconhecimento (Lei Epistemológica nº 1; DF-14)', () => {
  it('reconhece Evento Relevante com Fato e emite EventRecognized', () => {
    const result = EventAggregate.recognize(relevantInput());
    expect(result.isOk()).toBe(true);
    const ev = result.unwrap();
    expect(ev.classification.isRelevant()).toBe(true);
    const events = ev.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(EventRecognized);
    expect(events[0]?.eventName).toBe('event.recognized');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(ev.pullDomainEvents()).toHaveLength(0);
  });

  it('reconhece Evento Informativo sem Fato', () => {
    const result = EventAggregate.recognize(informativeInput());
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().classification.isInformative()).toBe(true);
    expect(result.unwrap().fact).toBeNull();
  });

  it('INV-EV-03 — Evento Relevante sem Fato é recusado', () => {
    const { fact: _omit, ...withoutFact } = relevantInput();
    void _omit;
    const result = EventAggregate.recognize(withoutFact);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-EV-03');
  });

  it('INV-EV-01 — classificação inválida é recusada (DF-14)', () => {
    // @ts-expect-error DF-14: só RELEVANT ou INFORMATIVE.
    const result = EventAggregate.recognize({ ...relevantInput(), classification: 'OUTRO' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-EV-01');
  });

  it('INV-EV-04 — Missão é obrigatória (tipo e runtime)', () => {
    // @ts-expect-error INV-EV-04/Lei 2: a Missão é obrigatória.
    const result = EventAggregate.recognize({ ...relevantInput(), mission: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-EV-04');
  });

  it('rastreabilidade — responsável é obrigatório', () => {
    // @ts-expect-error Art. 14º/Lei 3: responsável é obrigatório.
    const result = EventAggregate.recognize({ ...relevantInput(), recognizedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('EVENTO-RASTREABILIDADE');
  });

  it('rastreabilidade — momento de ocorrência inválido é recusado', () => {
    const result = EventAggregate.recognize({ ...relevantInput(), occurredAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('EVENTO-RASTREABILIDADE');
  });
});

describe('EventAggregate — identidade', () => {
  it('mesma EventId => igual; ids diferentes => diferentes', () => {
    const a = EventAggregate.recognize(relevantInput()).unwrap();
    const b = EventAggregate.recognize(relevantInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = EventAggregate.recognize({
      ...relevantInput(),
      id: EventId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('EventAggregate — estrutura proíbe estado/decisão/interpretação (INV-EV-02)', () => {
  it('não expõe estado, síntese de verdade, decisão, interpretação nem processamento', () => {
    const ev = EventAggregate.recognize(relevantInput()).unwrap();
    for (const forbidden of [
      'state',
      'estado',
      'alterState',
      'buildTruth',
      'verdade',
      'decide',
      'decision',
      'interpret',
      'process',
      'workflow',
    ]) {
      expect(forbidden in ev).toBe(false);
    }
  });
});

describe('EventAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Evento reconhecido satisfaz as invariantes de nível de entidade', () => {
    const ev = EventAggregate.recognize(relevantInput()).unwrap();
    const result = InvariantsEngine.enforce(ev, eventEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('EventAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-EV-01..INV-EV-05, sem lacunas nem duplicatas', () => {
    const ids = EVENT_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    for (let n = 1; n <= 5; n += 1) {
      const id = `INV-EV-0${String(n)}`;
      expect(ids).toContain(id);
    }
  });
});
