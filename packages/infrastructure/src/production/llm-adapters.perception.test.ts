// ─────────────────────────────────────────────────────────────────────────────
// Testes do parse de percepção (RFC-0044) — a relevância só cruza a fronteira se
// pertencer ao vocabulário FECHADO; valor inesperado do LLM degrada para AUSÊNCIA
// (não lança, não inventa, não encaminha). Enrichment existente permanece intacto.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { parseEnrichment } from './llm-adapters.js';

describe('parseEnrichment — relevância percebida (RFC-0044)', () => {
  it('valor do vocabulário fechado ("INFORMATIVE") ⇒ presente', () => {
    const e = parseEnrichment('{"summary":"x","perceivedRelevance":"INFORMATIVE"}');
    expect(e?.perceivedRelevance).toBe('INFORMATIVE');
  });

  it('valor inesperado do LLM ("important") ⇒ AUSENTE (degrada, não inventa)', () => {
    const e = parseEnrichment('{"summary":"x","perceivedRelevance":"important"}');
    expect(e).not.toBeNull();
    expect(e?.perceivedRelevance).toBeUndefined();
  });

  it('sem classificação no JSON ⇒ AUSENTE, e enrichment existente intacto', () => {
    const e = parseEnrichment('{"summary":"x","sentiment":"neutral","urgency":"high"}');
    expect(e?.perceivedRelevance).toBeUndefined();
    expect(e?.sentiment).toBe('neutral');
    expect(e?.urgency).toBe('high');
  });
});
