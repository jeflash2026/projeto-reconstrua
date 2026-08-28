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
      {
        postJson: () =>
          Promise.resolve({
            status: 429,
            body: { type: 'error', error: { type: 'rate_limit_error' } },
          }),
      },
      'k',
      'claude-x',
    );
    await expect(completion.complete('s', 'u')).rejects.toThrow(
      /anthropic HTTP 429.*rate_limit_error/,
    );
  });

  it('2xx não-200 (variações de gateway) ⇒ ACEITO', async () => {
    const completion = new AnthropicCompletion(
      {
        postJson: () =>
          Promise.resolve({
            status: 201,
            body: {
              content: [{ type: 'text', text: '{"summary":"ok"}' }],
              usage: { input_tokens: 1, output_tokens: 2 },
            },
          }),
      },
      'k',
      'claude-x',
    );
    const r = await completion.complete('s', 'u');
    expect(r.text).toContain('summary');
  });
});

// ── RETENTATIVA COM PAUSA (2026-08-27, "instabilidade rapidinha") ────────────
import { CompletionComRetentativa, type LlmCompletion } from './llm-adapters.js';

function completionRoteirizada(roteiro: string[]): {
  llm: LlmCompletion;
  chamadas: () => number;
} {
  let n = 0;
  return {
    llm: {
      name: 'fake',
      complete: () => {
        n += 1;
        const passo = roteiro.shift();
        if (passo === 'ok' || passo === undefined)
          return Promise.resolve({ text: 'resposta', tokensIn: 1, tokensOut: 1 });
        return Promise.reject(new Error(passo));
      },
    },
    chamadas: () => n,
  };
}

describe('CompletionComRetentativa — só o transitório repete, com pausa', () => {
  it('429/529 repetem com pausa e a resposta sai (o cliente nunca vê o fallback)', async () => {
    const esperas: number[] = [];
    const { llm, chamadas } = completionRoteirizada([
      'anthropic HTTP 529: {"type":"overloaded_error"}',
      'anthropic HTTP 429: rate limit',
      'ok',
    ]);
    const comRetry = new CompletionComRetentativa(llm, (ms) => {
      esperas.push(ms);
      return Promise.resolve();
    });
    const r = await comRetry.complete('s', 'u');
    expect(r.text).toBe('resposta');
    expect(chamadas()).toBe(3);
    expect(esperas).toEqual([1000, 2500]); // pausas reais entre tentativas
  });

  it('falha de rede (fetch failed) também repete', async () => {
    const { llm, chamadas } = completionRoteirizada(['fetch failed', 'ok']);
    const r = await new CompletionComRetentativa(llm, () => Promise.resolve()).complete('s', 'u');
    expect(r.text).toBe('resposta');
    expect(chamadas()).toBe(2);
  });

  it('erro PERMANENTE (HTTP 400) sobe na hora — nada de martelar a API', async () => {
    const { llm, chamadas } = completionRoteirizada(['anthropic HTTP 400: invalid request', 'ok']);
    await expect(
      new CompletionComRetentativa(llm, () => Promise.resolve()).complete('s', 'u'),
    ).rejects.toThrow('HTTP 400');
    expect(chamadas()).toBe(1);
  });

  it('transitório persistente esgota as pausas e o erro sobe (degrade honesto)', async () => {
    const { llm, chamadas } = completionRoteirizada([
      'anthropic HTTP 529: a',
      'anthropic HTTP 529: b',
      'anthropic HTTP 529: c',
      'ok',
    ]);
    await expect(
      new CompletionComRetentativa(llm, () => Promise.resolve()).complete('s', 'u'),
    ).rejects.toThrow('HTTP 529');
    expect(chamadas()).toBe(3); // 1 + 2 retentativas, nunca infinito
  });
});

// ── MODELO RÁPIDO na percepção (2026-08-28, "webchat lento") ─────────────────
import { createLlmBundle } from './llm-adapters.js';
import { ObservabilityRuntime, DEFAULT_PRODUCTION_CONFIG } from '@reconstrua/application';
import type { InboundEnvelope } from '@reconstrua/application';

describe('createLlmBundle — percepção no modelo rápido, expressão no principal', () => {
  it('understand() chama o modelo rápido; phrase() chama o principal', async () => {
    const modelosChamados: string[] = [];
    const http = {
      postJson: (_url: string, _headers: Record<string, string>, body: unknown) => {
        modelosChamados.push(String((body as { model?: string }).model));
        return Promise.resolve({
          status: 200,
          body: {
            content: [{ type: 'text', text: '{"summary":"ok","perceivedPurpose":"greeting"}' }],
            usage: { input_tokens: 1, output_tokens: 1 },
          },
        });
      },
    };
    const bundle = createLlmBundle({
      config: {
        ...DEFAULT_PRODUCTION_CONFIG,
        llm: {
          ...DEFAULT_PRODUCTION_CONFIG.llm,
          provider: 'anthropic',
          anthropicApiKey: 'k',
          anthropicModel: 'modelo-principal',
        },
      },
      http,
      observability: new ObservabilityRuntime(),
      clock: { now: () => new Date('2026-08-28T12:00:00.000Z') },
      modeloRapido: 'modelo-rapido',
    });
    const envelope = {
      kind: 'text',
      text: 'oi',
      editedText: null,
      fileName: null,
    } as InboundEnvelope;
    await bundle.perception.understand(envelope, { recentSummary: null });
    await bundle.expression.phrase({
      intent: { directive: 'responder', speechAct: null, topic: null, references: [] },
      context: { lastPercept: null },
      styleGuidance: 'ágil',
      avoidPhrases: [],
    } as never);
    expect(modelosChamados[0]).toBe('modelo-rapido'); // percepção
    expect(modelosChamados[1]).toBe('modelo-principal'); // expressão (texto ao cliente)
  });

  it('sem modeloRapido (ou igual ao principal) ⇒ tudo no principal', async () => {
    const modelosChamados: string[] = [];
    const http = {
      postJson: (_url: string, _headers: Record<string, string>, body: unknown) => {
        modelosChamados.push(String((body as { model?: string }).model));
        return Promise.resolve({
          status: 200,
          body: {
            content: [{ type: 'text', text: '{"summary":"ok"}' }],
            usage: { input_tokens: 1, output_tokens: 1 },
          },
        });
      },
    };
    const bundle = createLlmBundle({
      config: {
        ...DEFAULT_PRODUCTION_CONFIG,
        llm: {
          ...DEFAULT_PRODUCTION_CONFIG.llm,
          provider: 'anthropic',
          anthropicApiKey: 'k',
          anthropicModel: 'modelo-principal',
        },
      },
      http,
      observability: new ObservabilityRuntime(),
      clock: { now: () => new Date('2026-08-28T12:00:00.000Z') },
      modeloRapido: 'modelo-principal',
    });
    const envelope = {
      kind: 'text',
      text: 'oi',
      editedText: null,
      fileName: null,
    } as InboundEnvelope;
    await bundle.perception.understand(envelope, { recentSummary: null });
    expect(modelosChamados[0]).toBe('modelo-principal');
  });
});
