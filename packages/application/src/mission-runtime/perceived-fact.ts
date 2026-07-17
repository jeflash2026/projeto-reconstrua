// ─────────────────────────────────────────────────────────────────────────────
// PERCEIVED FACT (RFC-0042 / RFC-0044) — o fato ESTRUTURADO que atravessa a
// fronteira IA→Domínio. Não é linguagem: valor de VOCABULÁRIO FECHADO do domínio,
// com proveniência (DF-09; Art. 14º) e referência à evidência. O primeiro corte
// vertical carrega apenas a RELEVÂNCIA de evento (Relevante | Informativo).
// ─────────────────────────────────────────────────────────────────────────────
import type { EventClassificationValue } from '@reconstrua/domain';

/** Proveniência de um fato percebido — quem percebeu, quando, sobre qual evidência. */
export interface PerceivedFactProvenance {
  readonly perceivedBy: string;
  readonly perceivedAt: Date;
  readonly evidenceRef: string;
}

/** Relevância de evento percebida — vocabulário fechado do domínio; jamais texto. */
export interface PerceivedEventRelevance {
  readonly kind: 'event-relevance';
  readonly value: EventClassificationValue;
  readonly provenance: PerceivedFactProvenance;
}

/** Fatos que podem atravessar a fronteira IA→Domínio (RFC-0042). */
export type PerceivedFact = PerceivedEventRelevance;
