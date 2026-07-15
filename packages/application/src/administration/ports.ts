// ─────────────────────────────────────────────────────────────────────────────
// PORTS do Administration Intelligence / Founder Console. Os dados vêm SÓ do Read
// Model (AdminMetrics). O LLM entra APENAS como NARRAÇÃO (dado → linguagem) —
// nunca decide, nunca inventa número. A narração recebe a resposta JÁ calculada.
// ─────────────────────────────────────────────────────────────────────────────
import type { AdminMetrics } from './admin-metrics.js';

export interface AdminMetricsStore {
  load(): Promise<AdminMetrics | null>;
  save(metrics: AdminMetrics): Promise<void>;
}

/** O material factual que a narração converte em linguagem (nunca decide/inventa). */
export interface NarrationInput {
  readonly topic: string;
  readonly facts: Readonly<Record<string, string | number | boolean | null>>;
  readonly available: boolean;
}

/** Narração por LLM: dado → frase humana. Sandbox de linguagem (nunca decisão). */
export interface AdminNarrationPort {
  narrate(input: NarrationInput): Promise<string>;
}
