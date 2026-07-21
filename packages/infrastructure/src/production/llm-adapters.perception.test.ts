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

// 13ª rodada — a MESMA classe de silêncio do HTTP 201 da mídia: erro HTTP do
// provedor virava texto vazio ("parse falhou; resposta=''") sem nunca revelar o
// status. Agora o erro carrega status + excerto do corpo (causa literal no log).
import { AnthropicCompletion } from './llm-adapters.js';

describe('AnthropicCompletion — erro HTTP vira causa LITERAL (nunca texto vazio)', () => {
  it('429 rate limit ⇒ lança com status e corpo (o retry/track veem a verdade)', async () => {
    const completion = new AnthropicCompletion(
      { postJson: () => Promise.resolve({ status: 429, body: { type: 'error', error: { type: 'rate_limit_error' } } }) },
      'k',
      'claude-x',
    );
    await expect(completion.complete('s', 'u')).rejects.toThrow(/anthropic HTTP 429.*rate_limit_error/);
  });

  it('2xx não-200 (variações de gateway) ⇒ ACEITO', async () => {
    const completion = new AnthropicCompletion(
      { postJson: () => Promise.resolve({ status: 201, body: { content: [{ type: 'text', text: '{"summary":"ok"}' }], usage: { input_tokens: 1, output_tokens: 2 } } }) },
      'k',
      'claude-x',
    );
    const r = await completion.complete('s', 'u');
    expect(r.text).toContain('summary');
  });
});
