// ─────────────────────────────────────────────────────────────────────────────
// HTTP CLIENT — port mínimo de HTTP (POST JSON) + adapter baseado no `fetch`
// global (Node 22). Injetável para que o gateway seja testável sem rede.
// ─────────────────────────────────────────────────────────────────────────────

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface HttpClient {
  postJson(
    url: string,
    headers: Readonly<Record<string, string>>,
    body: unknown,
  ): Promise<HttpResponse>;
}

/** Adapter de produção sobre o `fetch` global.
 *
 *  TETO DE ESPERA (2026-09-21, "a AHRI parou de responder"): sem prazo, uma
 *  chamada pendurada (LLM ou Evolution que aceita a conexão e não responde)
 *  trava o turno INTEIRO — e como os turnos de uma conversa são estritamente
 *  sequenciais, a conversa emudece até o processo reiniciar. Com prazo, a
 *  chamada falha, o `ResilientHttpClient` repete e, no pior caso, o turno
 *  degrada com resposta — nunca em silêncio. */
export class FetchHttpClient implements HttpClient {
  constructor(private readonly timeoutMs: number = 30_000) {}

  async postJson(
    url: string,
    headers: Readonly<Record<string, string>>,
    body: unknown,
  ): Promise<HttpResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      ...(this.timeoutMs > 0 ? { signal: AbortSignal.timeout(this.timeoutMs) } : {}),
    });
    const text = await response.text();
    let parsed: unknown = null;
    if (text !== '') {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: response.status, body: parsed };
  }
}
