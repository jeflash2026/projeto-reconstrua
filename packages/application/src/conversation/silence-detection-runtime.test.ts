// ─────────────────────────────────────────────────────────────────────────────
// Testes do SilenceDetectionRuntime — percepção mecânica de silêncio/timeout, sem
// decisão; timeout precede silêncio; silêncio já percebido não re-dispara.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { SilenceDetectionRuntime } from './silence-detection-runtime.js';
import { DEFAULT_HUMANIZATION_POLICY, type HumanizationPolicy } from './humanization-policy.js';
import type { Session } from './ports.js';

const POLICY: HumanizationPolicy = {
  ...DEFAULT_HUMANIZATION_POLICY,
  silenceThresholdMs: 1_000,
  timeoutThresholdMs: 5_000,
};

const T0 = new Date('2026-07-14T00:00:00.000Z');

function session(over: Partial<Session>): Session {
  return {
    chatId: 'c1',
    openedAt: T0,
    lastInboundAt: T0,
    lastOutboundAt: null,
    turns: 1,
    presence: 'available',
    awaitingDocuments: false,
    status: 'active',
    lastSilenceNoticeAt: null,
    ...over,
  };
}

describe('SilenceDetectionRuntime', () => {
  const rt = new SilenceDetectionRuntime(POLICY);

  it('não sinaliza antes do limiar', () => {
    const now = new Date(T0.getTime() + 500);
    expect(rt.scan([session({})], now)).toHaveLength(0);
  });

  it('sinaliza silêncio entre os limiares', () => {
    const now = new Date(T0.getTime() + 2_000);
    const signals = rt.scan([session({})], now);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.kind).toBe('silence');
    expect(signals[0]?.envelope.kind).toBe('silence');
  });

  it('timeout precede silêncio acima do limiar de timeout', () => {
    const now = new Date(T0.getTime() + 6_000);
    const signals = rt.scan([session({})], now);
    expect(signals[0]?.kind).toBe('timeout');
  });

  it('não re-sinaliza silêncio já percebido após a última entrada', () => {
    const now = new Date(T0.getTime() + 2_000);
    const noticed = session({ lastSilenceNoticeAt: new Date(T0.getTime() + 1_500) });
    expect(rt.scan([noticed], now)).toHaveLength(0);
  });

  it('ignora sessões não ativas', () => {
    const now = new Date(T0.getTime() + 6_000);
    expect(rt.scan([session({ status: 'paused' })], now)).toHaveLength(0);
  });
});
