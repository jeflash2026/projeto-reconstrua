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

/** Adapter de produção sobre o `fetch` global. */
export class FetchHttpClient implements HttpClient {
  async postJson(
    url: string,
    headers: Readonly<Record<string, string>>,
    body: unknown,
  ): Promise<HttpResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
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
