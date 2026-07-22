// ─────────────────────────────────────────────────────────────────────────────
// Testes da Retry Policy — backoff exponencial, teto, máximo de tentativas (poison)
// e jitter determinístico.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ExponentialBackoffRetryPolicy } from './retry-policy.js';

describe('ExponentialBackoffRetryPolicy', () => {
  it('cresce exponencialmente e respeita o teto', () => {
    const p = new ExponentialBackoffRetryPolicy({
      baseMs: 100,
      factor: 2,
      maxMs: 500,
      maxAttempts: 10,
    });
    expect(p.decide(1)).toEqual({ retry: true, delayMs: 100 });
    expect(p.decide(2)).toEqual({ retry: true, delayMs: 200 });
    expect(p.decide(3)).toEqual({ retry: true, delayMs: 400 });
    expect(p.decide(4)).toEqual({ retry: true, delayMs: 500 }); // 800 capado em 500
    expect(p.decide(9)).toEqual({ retry: true, delayMs: 500 });
  });

  it('desiste (→ Dead Letter) ao atingir maxAttempts (poison detection)', () => {
    const p = new ExponentialBackoffRetryPolicy({
      baseMs: 100,
      factor: 2,
      maxMs: 1000,
      maxAttempts: 3,
    });
    expect(p.decide(1).retry).toBe(true);
    expect(p.decide(2).retry).toBe(true);
    expect(p.decide(3)).toEqual({ retry: false, delayMs: 0 });
    expect(p.decide(4).retry).toBe(false);
  });

  it('jitter é determinístico com RNG injetado e fica dentro dos limites', () => {
    const high = new ExponentialBackoffRetryPolicy({
      baseMs: 1000,
      factor: 1,
      maxMs: 1000,
      maxAttempts: 5,
      jitter: 0.5,
      random: () => 1,
    });
    const low = new ExponentialBackoffRetryPolicy({
      baseMs: 1000,
      factor: 1,
      maxMs: 1000,
      maxAttempts: 5,
      jitter: 0.5,
      random: () => 0,
    });
    expect(high.decide(1).delayMs).toBe(1500); // 1000 * (1 + 0.5)
    expect(low.decide(1).delayMs).toBe(500); // 1000 * (1 - 0.5)
  });
});
