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
  postJson(url: string, _headers: Readonly<Record<string, string>>, body: unknown): Promise<HttpResponse> {
    this.lastUrl = url;
    this.lastBody = body;
    return Promise.resolve(this.response);
  }
}

const okResponse: HttpResponse = { status: 200, body: { content: [{ type: 'text', text: 'CONTEUDO TRANSCRITO' }] } };
const bytes = new Uint8Array([1, 2, 3, 4]);

function blockOf(body: unknown): Record<string, unknown> {
  const messages = (body as { messages?: { content?: unknown[] }[] }).messages ?? [];
  const content = messages[0]?.content ?? [];
  return (content[0] ?? {}) as Record<string, unknown>;
}

describe('AnthropicVisionClient (CAT-03A)', () => {
  it('PNG ⇒ bloco image + retorna o texto', async () => {
    const http = new CapturingHttp(okResponse);
    const text = await new AnthropicVisionClient(http, 'k', 'claude-sonnet-5').read(bytes, 'image/png');
    expect(text).toBe('CONTEUDO TRANSCRITO');
    expect(http.lastUrl).toContain('api.anthropic.com/v1/messages');
    expect(blockOf(http.lastBody)).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/png' } });
  });

  it('PDF ⇒ bloco document', async () => {
    const http = new CapturingHttp(okResponse);
    await new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'application/pdf');
    expect(blockOf(http.lastBody)).toMatchObject({ type: 'document', source: { type: 'base64', media_type: 'application/pdf' } });
  });

  it('mime não suportado ⇒ null (sem chamar o HTTP)', async () => {
    const http = new CapturingHttp(okResponse);
    expect(await new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'application/zip')).toBeNull();
    expect(http.lastUrl).toBe('');
  });

  it('erro HTTP (429/500) ⇒ LANÇA com status + corpo (o serviço loga a causa literal)', async () => {
    const http = new CapturingHttp({ status: 429, body: { type: 'error', error: { type: 'rate_limit_error' } } });
    await expect(new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'image/jpeg')).rejects.toThrow(
      /anthropic-vision HTTP 429.*rate_limit_error/,
    );
  });

  it('2xx não-200 ⇒ ACEITO (lição do HTTP 201 da mídia)', async () => {
    const http = new CapturingHttp({ status: 201, body: { content: [{ type: 'text', text: 'TRANSCRITO' }] } });
    expect(await new AnthropicVisionClient(http, 'k', 'm').read(bytes, 'image/jpeg')).toBe('TRANSCRITO');
  });
});
