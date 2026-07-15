// ─────────────────────────────────────────────────────────────────────────────
// Testes da reidratação genérica.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { rehydrate } from './rehydrator.js';
import type { StoredEvent, StoredProvenance } from './stored-event.js';

const NO_PROV: StoredProvenance = {
  factRef: null,
  actor: null,
  decisionType: null,
  fundamento: null,
  operationalRuleRef: null,
};

function evt(version: number, amount: number): StoredEvent {
  return {
    id: `e${String(version)}`,
    streamType: 'account',
    streamId: 'a1',
    version,
    eventType: 'credited',
    isRelevant: true,
    payload: { amount },
    provenance: { ...NO_PROV, factRef: 'f1' },
    previousHash: null,
    hash: `h${String(version)}`,
    occurredAt: new Date('2026-07-14T00:00:00.000Z'),
    recordedAt: new Date('2026-07-14T00:00:00.000Z'),
    globalSeq: version,
  };
}

interface Balance {
  readonly total: number;
}
const fold = (s: Balance, e: StoredEvent): Balance => ({
  total: s.total + Number((e.payload as { amount: number }).amount),
});

describe('rehydrate', () => {
  it('dobra os eventos em ordem e retorna estado + versão', () => {
    const { state, version } = rehydrate<Balance>({ total: 0 }, [evt(1, 10), evt(2, 5)], fold);
    expect(state.total).toBe(15);
    expect(version).toBe(2);
  });

  it('parte de fromVersion (uso com snapshot)', () => {
    const { state, version } = rehydrate<Balance>({ total: 100 }, [evt(4, 1)], fold, 3);
    expect(state.total).toBe(101);
    expect(version).toBe(4);
  });

  it('rejeita versão fora de sequência (corrupção)', () => {
    expect(() => rehydrate<Balance>({ total: 0 }, [evt(1, 10), evt(3, 5)], fold)).toThrow();
  });

  it('stream vazio retorna a semente na versão 0', () => {
    const { state, version } = rehydrate<Balance>({ total: 7 }, [], fold);
    expect(state.total).toBe(7);
    expect(version).toBe(0);
  });
});
