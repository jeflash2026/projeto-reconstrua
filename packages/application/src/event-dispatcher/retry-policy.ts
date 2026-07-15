// ─────────────────────────────────────────────────────────────────────────────
// Retry Policy — configurável, auditável, sem duplicidade. Decide, a cada tentativa
// falha, se deve reprocessar (com atraso de BACKOFF EXPONENCIAL) ou desistir
// (→ Dead Letter Queue = detecção de mensagem envenenada / poison).
//
// PURA e DETERMINÍSTICA: o jitter usa uma função aleatória INJETADA (default
// Math.random), permitindo testes determinísticos (jitter = 0 ou RNG fixo).
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryDecision {
  /** true = reprocessar após `delayMs`; false = desistir (Dead Letter). */
  readonly retry: boolean;
  /** Atraso até a próxima tentativa (ms). Zero quando `retry` é false. */
  readonly delayMs: number;
}

export interface RetryPolicy {
  /** `attempt` = número de tentativas JÁ realizadas (>= 1). */
  decide(attempt: number): RetryDecision;
}

export interface ExponentialBackoffOptions {
  /** Atraso base (ms). */
  readonly baseMs: number;
  /** Fator de crescimento por tentativa. */
  readonly factor: number;
  /** Teto do atraso (ms). */
  readonly maxMs: number;
  /** Máximo de tentativas antes de Dead Letter (detecção de poison). */
  readonly maxAttempts: number;
  /** Fração de jitter [0..1] aplicada ao atraso (default 0). */
  readonly jitter?: number;
  /** Fonte de aleatoriedade para o jitter (default Math.random). */
  readonly random?: () => number;
}

export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  private readonly baseMs: number;
  private readonly factor: number;
  private readonly maxMs: number;
  private readonly maxAttempts: number;
  private readonly jitter: number;
  private readonly random: () => number;

  constructor(options: ExponentialBackoffOptions) {
    this.baseMs = options.baseMs;
    this.factor = options.factor;
    this.maxMs = options.maxMs;
    this.maxAttempts = options.maxAttempts;
    this.jitter = options.jitter ?? 0;
    this.random = options.random ?? Math.random;
  }

  decide(attempt: number): RetryDecision {
    if (attempt >= this.maxAttempts) {
      return { retry: false, delayMs: 0 };
    }
    const raw = Math.min(this.baseMs * Math.pow(this.factor, attempt - 1), this.maxMs);
    // Jitter simétrico: raw * (1 ± jitter).
    const spread = this.jitter === 0 ? 0 : (this.random() * 2 - 1) * this.jitter;
    const delayMs = Math.max(0, Math.round(raw * (1 + spread)));
    return { retry: true, delayMs };
  }
}
