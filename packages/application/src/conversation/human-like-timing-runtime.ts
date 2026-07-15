// ─────────────────────────────────────────────────────────────────────────────
// HUMAN-LIKE TIMING RUNTIME — calcula QUANTO tempo a AHRI leva para responder,
// como um humano: lê a mensagem, pensa, e digita proporcionalmente ao tamanho.
//
// DETERMINÍSTICO dado o RNG injetado. GARANTE `minPreSendMs` — jamais instantâneo.
// Não decide SE responde (isso é do Brain); decide só a cadência humana do COMO.
// ─────────────────────────────────────────────────────────────────────────────
import { applyJitter, type HumanizationPolicy, type Rng } from './humanization-policy.js';

export interface DeliveryTiming {
  readonly readingDelayMs: number;
  readonly thinkingDelayMs: number;
  readonly typingDurationMs: number;
  readonly totalMs: number;
}

export class HumanLikeTimingRuntime {
  constructor(
    private readonly policy: HumanizationPolicy,
    private readonly rng: Rng,
  ) {}

  /**
   * @param inboundLength  tamanho (chars) da última mensagem do cliente (lê antes de responder)
   * @param outboundLength tamanho (chars) da resposta a digitar
   * @param timingHintMs   dica de tempo do Brain (ms), respeitada como piso adicional
   */
  compute(inboundLength: number, outboundLength: number, timingHintMs: number | null = null): DeliveryTiming {
    const p = this.policy;

    const rawReading = Math.min(inboundLength * p.readMsPerChar, p.maxReadMs);
    const readingDelayMs = applyJitter(rawReading, p.jitter, this.rng);

    const thinkingDelayMs = applyJitter(p.baseThinkMs, p.jitter, this.rng);

    const rawTyping = (outboundLength / p.typeCharsPerSecond) * 1_000;
    const boundedTyping = Math.min(Math.max(rawTyping, p.minTypeMs), p.maxTypeMs);
    const typingDurationMs = applyJitter(boundedTyping, p.jitter, this.rng);

    const hint = timingHintMs ?? 0;
    const naturalTotal = readingDelayMs + thinkingDelayMs + typingDurationMs;
    const totalMs = Math.max(naturalTotal, p.minPreSendMs, hint);

    return { readingDelayMs, thinkingDelayMs, typingDurationMs, totalMs };
  }
}
