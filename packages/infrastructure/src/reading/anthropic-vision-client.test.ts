// ─────────────────────────────────────────────────────────────────────────────
// Testes do AnthropicVisionClient (CAT-03A) — monta o bloco de conteúdo correto
// (image vs document) conforme o mime, e parseia o texto da resposta.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { HttpClient, HttpResponse } from '../conversation/evolution/http-client.js';
import { AnthropicVisionClient } from './anthropic-vision-client.js';

class CapturingHttp implements HttpClient {
  lastUrl = '';
  lastBody: unknown = null;
  constructor(private readonly response: HttpResponse) {}
  postJson(
    url: string,
    _headers: Readonly<Record<string, string>>,
    body: unknown,
  ): Promise<HttpResponse> {
    this.lastUrl = url;
    this.lastBody = body;
    return Promise.resolve(this.response);
  }
}

const okResponse: HttpResponse = {
  status: 200,
  body: {
    content: [{ type: 'text', text: 'CONTEUDO TRANSCRITO' }],
    usage: { input_tokens: 1500, output_tokens: 700 },
  },
};
const bytes = new Uint8Array([1, 2, 3, 4]);

function blockOf(body: unknown): Record<string, unknown> {
  const messages = (body as { messages?: { content?: unknown[] }[] }).messages ?? [];
  const content = messages[0]?.content ?? [];
  return (content[0] ?? {}) as Record<string, unknown>;
}

describe('AnthropicVisionClient (CAT-03A)', () => {
  it('PNG ⇒ bloco image + retorna o texto', async () => {
    const http = new CapturingHttp(okResponse);
    const leitura = await new AnthropicVisionClient(http, 'k', 'claude-sonnet-5').read(
      bytes,
      'image/png',
    );
    expect(leitura?.texto).toBe('CONTEUDO TRANSCRITO');
    expect(http.lastUrl).toContain('api.anthropic.com/v1/messages');
    expect(blockOf(http.lastBody)).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png' },
    });
  });

  it('PDF ⇒ bloco document', async () => {
    const http = new CapturingHttp(okResponse);
    await new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'application/pdf');
    expect(blockOf(http.lastBody)).toMatchObject({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf' },
    });
  });

  it('mime não suportado ⇒ null (sem chamar o HTTP)', async () => {
    const http = new CapturingHttp(okResponse);
    expect(
      await new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'application/zip'),
    ).toBeNull();
    expect(http.lastUrl).toBe('');
  });

  it('erro HTTP (429/500) ⇒ LANÇA com status + corpo (o serviço loga a causa literal)', async () => {
    const http = new CapturingHttp({
      status: 429,
      body: { type: 'error', error: { type: 'rate_limit_error' } },
    });
    await expect(
      new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'image/jpeg'),
    ).rejects.toThrow(/anthropic-vision HTTP 429.*rate_limit_error/);
  });

  it('2xx não-200 ⇒ ACEITO (lição do HTTP 201 da mídia)', async () => {
    const http = new CapturingHttp({
      status: 201,
      body: { content: [{ type: 'text', text: 'TRANSCRITO' }] },
    });
    expect((await new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'image/jpeg'))?.texto).toBe(
      'TRANSCRITO',
    );
  });

  it('15ª rodada (verso do RG): content em MÚLTIPLOS blocos ⇒ concatena todos os textos', async () => {
    const http = new CapturingHttp({
      status: 200,
      body: {
        content: [
          { type: 'text', text: 'CARTEIRA DE IDENTIDADE' },
          { type: 'text', text: 'ORGAO EXPEDIDOR SSP' },
        ],
      },
    });
    expect((await new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'image/jpeg'))?.texto).toBe(
      'CARTEIRA DE IDENTIDADE\nORGAO EXPEDIDOR SSP',
    );
  });

  it('2xx SEM texto no content ⇒ LANÇA com o corpo real (nunca null mudo)', async () => {
    const http = new CapturingHttp({ status: 200, body: { content: [], stop_reason: 'end_turn' } });
    await expect(
      new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'image/jpeg'),
    ).rejects.toThrow(/anthropic-vision 2xx sem texto.*end_turn/);
  });

  it('Medidor de Custo: devolve o USO (tokens) da resposta; ausente ⇒ null', async () => {
    const comUso = await new AnthropicVisionClient(new CapturingHttp(okResponse), 'k', 'm').read(
      bytes,
      'image/png',
    );
    expect(comUso).toMatchObject({ tokensIn: 1500, tokensOut: 700 });
    const semUso = await new AnthropicVisionClient(
      new CapturingHttp({ status: 200, body: { content: [{ type: 'text', text: 'X' }] } }),
      'k',
      'm',
    ).read(bytes, 'image/png');
    expect(semUso).toMatchObject({ texto: 'X', tokensIn: null, tokensOut: null });
  });
});
