// ─────────────────────────────────────────────────────────────────────────────
// Testes do avaliador de CONDIÇÕES — operadores comparáveis, in/contains/truthy/
// falsy e composição all/any/not. Determinístico e total.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { evaluateCondition } from './conditions.js';
import type { BrainFacts } from './facts.js';

const facts: BrainFacts = {
  perceptKind: 'text',
  minDeadlineDays: 2,
  hasPendingDocuments: true,
  pendingList: ['rg', 'cpf'],
  awaitingDocuments: false,
};

describe('evaluateCondition', () => {
  it('igualdade e desigualdade de string/boolean', () => {
    expect(evaluateCondition({ fact: 'perceptKind', op: 'eq', value: 'text' }, facts)).toBe(true);
    expect(evaluateCondition({ fact: 'perceptKind', op: 'neq', value: 'audio' }, facts)).toBe(true);
    expect(evaluateCondition({ fact: 'awaitingDocuments', op: 'eq', value: false }, facts)).toBe(
      true,
    );
  });

  it('comparações numéricas', () => {
    expect(evaluateCondition({ fact: 'minDeadlineDays', op: 'lte', value: 3 }, facts)).toBe(true);
    expect(evaluateCondition({ fact: 'minDeadlineDays', op: 'gt', value: 5 }, facts)).toBe(false);
  });

  it('in e contains', () => {
    expect(
      evaluateCondition({ fact: 'perceptKind', op: 'in', value: ['text', 'audio'] }, facts),
    ).toBe(true);
    expect(evaluateCondition({ fact: 'pendingList', op: 'contains', value: 'rg' }, facts)).toBe(
      true,
    );
    expect(evaluateCondition({ fact: 'pendingList', op: 'contains', value: 'foto' }, facts)).toBe(
      false,
    );
  });

  it('truthy e falsy', () => {
    expect(evaluateCondition({ fact: 'hasPendingDocuments', op: 'truthy' }, facts)).toBe(true);
    expect(evaluateCondition({ fact: 'awaitingDocuments', op: 'falsy' }, facts)).toBe(true);
    expect(evaluateCondition({ fact: 'inexistente', op: 'falsy' }, facts)).toBe(true);
  });

  it('composição all/any/not', () => {
    expect(
      evaluateCondition(
        {
          all: [
            { fact: 'perceptKind', op: 'eq', value: 'text' },
            { fact: 'minDeadlineDays', op: 'lte', value: 3 },
          ],
        },
        facts,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          any: [
            { fact: 'perceptKind', op: 'eq', value: 'x' },
            { fact: 'hasPendingDocuments', op: 'truthy' },
          ],
        },
        facts,
      ),
    ).toBe(true);
    expect(evaluateCondition({ not: { fact: 'awaitingDocuments', op: 'truthy' } }, facts)).toBe(
      true,
    );
  });
});
