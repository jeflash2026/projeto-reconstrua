// ─────────────────────────────────────────────────────────────────────────────
// HUMANIZATION POLICY — os PARÂMETROS do comportamento humano da entrega.
//
// "Nunca responder instantaneamente. Nunca responder mecanicamente. Nunca igual."
// Estes parâmetros são CONFIGURAÇÃO OPERACIONAL (timings — ADR-0002A §8: parâmetros
// de Regra Operacional a aprovar; NÃO são Canon congelado). A Conversa não os
// inventa: recebe-os. O LLM não os toca. O tempo é DETERMINÍSTICO dado o RNG
// injetado (jitter reprodutível em teste).
// ─────────────────────────────────────────────────────────────────────────────

/** Fonte de aleatoriedade injetável (default Math.random). Determinismo em teste. */
export type Rng = () => number;

export interface HumanizationPolicy {
  /** Tempo por caractere "lendo" a mensagem do cliente (ms/char). */
  readonly readMsPerChar: number;
  /** Teto do tempo de leitura (ms). */
  readonly maxReadMs: number;
  /** Pausa de "pensar" antes de começar a digitar (ms), por ato de fala. */
  readonly baseThinkMs: number;
  /** Velocidade de digitação (caracteres por segundo). */
  readonly typeCharsPerSecond: number;
  /** Piso do tempo de digitação (ms) — nunca digitar em zero. */
  readonly minTypeMs: number;
  /** Teto do tempo de digitação (ms) — mensagens longas não "digitam" eternamente. */
  readonly maxTypeMs: number;
  /** Piso ABSOLUTO do atraso total pré-envio (ms) — jamais instantâneo. */
  readonly minPreSendMs: number;
  /** Fração de jitter simétrico [0..1] aplicada a cada componente de tempo. */
  readonly jitter: number;
  /** Pausa entre mensagens consecutivas numa rajada (ms). */
  readonly interMessageMs: number;
  /** Limiar de similaridade a partir do qual um fraseado conta como repetição [0..1]. */
  readonly repetitionThreshold: number;
  /** Quantas frases recentes da AHRI o guard evita repetir. */
  readonly antiRepetitionWindow: number;
  /** Silêncio do cliente (ms) a partir do qual se percebe "silêncio". */
  readonly silenceThresholdMs: number;
  /** Silêncio do cliente (ms) a partir do qual se percebe "timeout". */
  readonly timeoutThresholdMs: number;
}

/** Política padrão — valores humanos plausíveis, todos ajustáveis por RO. */
export const DEFAULT_HUMANIZATION_POLICY: HumanizationPolicy = {
  readMsPerChar: 18,
  maxReadMs: 6_000,
  baseThinkMs: 700,
  typeCharsPerSecond: 12,
  minTypeMs: 900,
  maxTypeMs: 12_000,
  minPreSendMs: 1_200,
  jitter: 0.25,
  interMessageMs: 800,
  repetitionThreshold: 0.8,
  antiRepetitionWindow: 8,
  silenceThresholdMs: 20 * 60 * 1_000, // 20 min
  timeoutThresholdMs: 24 * 60 * 60 * 1_000, // 24 h
};

/** Aplica jitter simétrico determinístico: valor * (1 ± jitter). Nunca negativo. */
export function applyJitter(value: number, jitter: number, rng: Rng): number {
  if (jitter <= 0) return Math.round(value);
  const spread = (rng() * 2 - 1) * jitter;
  return Math.max(0, Math.round(value * (1 + spread)));
}
