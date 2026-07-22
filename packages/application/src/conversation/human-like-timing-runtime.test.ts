// ─────────────────────────────────────────────────────────────────────────────
// Testes do HumanLikeTimingRuntime — prova "nunca instantâneo", proporcionalidade
// ao tamanho, determinismo com RNG fixo e limites do jitter.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { HumanLikeTimingRuntime } from './human-like-timing-runtime.js';
import { DEFAULT_HUMANIZATION_POLICY, type Rng } from './humanization-policy.js';

const noJitter: Rng = () => 0.5; // spread = (0.5*2-1)*j = 0 → sem jitter

describe('HumanLikeTimingRuntime', () => {
  it('NUNCA responde instantaneamente: total >= minPreSendMs sempre', () => {
    const rt = new HumanLikeTimingRuntime(DEFAULT_HUMANIZATION_POLICY, noJitter);
    for (const outLen of [0, 1, 5, 50, 500, 5000]) {
      const t = rt.compute(0, outLen);
      expect(t.totalMs).toBeGreaterThanOrEqual(DEFAULT_HUMANIZATION_POLICY.minPreSendMs);
      expect(t.totalMs).toBeGreaterThan(0);
    }
  });

  it('é determinístico e proporcional ao tamanho da resposta (mais texto → mais digitação)', () => {
    const rt = new HumanLikeTimingRuntime(DEFAULT_HUMANIZATION_POLICY, noJitter);
    const short = rt.compute(10, 40);
    const long = rt.compute(10, 2400);
    // Cadência ágil (decreto 2026-07-22): 40 chars / 40 cps = 1000ms;
    // 2400 chars = 60000 → limitado a maxTypeMs 4000.
    expect(short.typingDurationMs).toBe(1_000);
    expect(long.typingDurationMs).toBe(DEFAULT_HUMANIZATION_POLICY.maxTypeMs);
    expect(long.typingDurationMs).toBeGreaterThan(short.typingDurationMs);
    // Reprodutível.
    expect(rt.compute(10, 40)).toEqual(short);
  });

  it('respeita a dica de tempo do Brain como piso adicional', () => {
    const rt = new HumanLikeTimingRuntime(DEFAULT_HUMANIZATION_POLICY, noJitter);
    const withoutHint = rt.compute(5, 10);
    const withHint = rt.compute(5, 10, withoutHint.totalMs + 10_000);
    expect(withHint.totalMs).toBe(withoutHint.totalMs + 10_000);
  });

  it('mantém o jitter dentro de ±jitter', () => {
    const low = new HumanLikeTimingRuntime(DEFAULT_HUMANIZATION_POLICY, () => 0).compute(100, 120);
    const high = new HumanLikeTimingRuntime(DEFAULT_HUMANIZATION_POLICY, () => 1).compute(100, 120);
    const mid = new HumanLikeTimingRuntime(DEFAULT_HUMANIZATION_POLICY, noJitter).compute(100, 120);
    // rng=0 → fator 0.75; rng=1 → fator 1.25 sobre cada componente.
    expect(low.typingDurationMs).toBeLessThan(mid.typingDurationMs);
    expect(high.typingDurationMs).toBeGreaterThan(mid.typingDurationMs);
  });
});
