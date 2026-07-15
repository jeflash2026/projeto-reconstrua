// ─────────────────────────────────────────────────────────────────────────────
// Testes do encadeamento verificável (R9; Lei 4). Determinismo canônico,
// encadeamento e detecção de adulteração.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  canonicalEventString,
  computeHash,
  assertStreamIntegrity,
  GENESIS,
} from './hash-chain.js';
import type { Hasher } from './ports.js';
import type { StoredEvent, StoredProvenance } from './stored-event.js';
import { EventStoreIntegrityError } from './errors.js';

// Hasher determinístico de teste (djb2 em hex) — suficiente para detectar mudança de conteúdo.
const testHasher: Hasher = {
  hash(input: string): string {
    let h = 5381;
    for (let i = 0; i < input.length; i += 1) {
      h = (h * 33) ^ input.charCodeAt(i);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  },
};

const NO_PROV: StoredProvenance = {
  factRef: null,
  actor: null,
  decisionType: null,
  fundamento: null,
  operationalRuleRef: null,
};

function buildStream(streamId: string, count: number): StoredEvent[] {
  const events: StoredEvent[] = [];
  let previousHash: string | null = null;
  for (let v = 1; v <= count; v += 1) {
    const core = {
      streamType: 'mission',
      streamId,
      version: v,
      eventType: 'mission.created',
      isRelevant: false,
      payload: { n: v },
      provenance: NO_PROV,
      occurredAt: new Date('2026-07-14T12:00:00.000Z'),
    };
    const hash = computeHash(previousHash, core, testHasher);
    events.push({
      ...core,
      id: `evt-${streamId}-${String(v)}`,
      previousHash,
      hash,
      recordedAt: new Date('2026-07-14T12:00:01.000Z'),
      globalSeq: v,
    });
    previousHash = hash;
  }
  return events;
}

describe('canonicalEventString — determinismo', () => {
  it('é estável independentemente da ordem das chaves do payload', () => {
    const base = {
      streamType: 'mission',
      streamId: 'm1',
      version: 1,
      eventType: 'x',
      isRelevant: false,
      provenance: NO_PROV,
      occurredAt: new Date('2026-07-14T00:00:00.000Z'),
    };
    const a = canonicalEventString({ ...base, payload: { a: 1, b: 2, nested: { y: 1, x: 2 } } });
    const b = canonicalEventString({ ...base, payload: { nested: { x: 2, y: 1 }, b: 2, a: 1 } });
    expect(a).toBe(b);
  });
});

describe('computeHash — encadeamento', () => {
  it('a versão 1 encadeia a partir de GENESIS e muda com o previousHash', () => {
    const core = {
      streamType: 'mission',
      streamId: 'm1',
      version: 1,
      eventType: 'mission.created',
      isRelevant: false,
      payload: {},
      provenance: NO_PROV,
      occurredAt: new Date('2026-07-14T00:00:00.000Z'),
    };
    const h1 = computeHash(null, core, testHasher);
    const h1genesis = computeHash(GENESIS, core, testHasher);
    const h1other = computeHash('outro', core, testHasher);
    expect(h1).toBe(h1genesis); // null == GENESIS
    expect(h1).not.toBe(h1other);
  });
});

describe('assertStreamIntegrity', () => {
  it('aceita uma cadeia íntegra', () => {
    expect(() => assertStreamIntegrity(buildStream('m1', 5), testHasher)).not.toThrow();
  });

  it('detecta payload adulterado', () => {
    const s = buildStream('m2', 3);
    const tampered = [...s];
    tampered[1] = { ...s[1]!, payload: { n: 999 } };
    expect(() => assertStreamIntegrity(tampered, testHasher)).toThrow(EventStoreIntegrityError);
  });

  it('detecta versão fora de sequência', () => {
    const s = buildStream('m3', 3);
    const broken = [s[0]!, s[2]!];
    expect(() => assertStreamIntegrity(broken, testHasher)).toThrow(EventStoreIntegrityError);
  });

  it('detecta previousHash divergente', () => {
    const s = buildStream('m4', 3);
    const broken = [...s];
    broken[2] = { ...s[2]!, previousHash: 'errado' };
    expect(() => assertStreamIntegrity(broken, testHasher)).toThrow(EventStoreIntegrityError);
  });
});
