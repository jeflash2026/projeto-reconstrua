// ─────────────────────────────────────────────────────────────────────────────
// PONTE DO CHAT COM A API (2026-09-21) — o site fala com a AHRI pelo SERVIDOR,
// não pelo navegador.
//
// Por quê: o domínio tem duas entradas no proxy (com e sem `www`) e o caminho
// /webchat só existia em uma delas. Quem abria o site sem o `www` via a caixa
// de conversa falhar com "não foi possível iniciar agora" — a chamada caía na
// própria landing e voltava 404. Passando pelo servidor do site, a conversa
// funciona em QUALQUER endereço, hoje e em qualquer domínio novo de campanha,
// sem depender de configuração de proxy.
// ─────────────────────────────────────────────────────────────────────────────

/** A API de produção na rede interna (o mesmo host que serve /webchat). */
export function apiUrl(): string {
  return (process.env['API_URL'] ?? 'http://api:3101').replace(/\/+$/, '');
}

/** Repassa a resposta da API como veio (status e corpo), sem interpretar. */
export async function repassar(
  caminho: string,
  init: RequestInit & { readonly method: 'GET' | 'POST' },
): Promise<Response> {
  try {
    const resposta = await fetch(`${apiUrl()}${caminho}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const corpo = await resposta.text();
    return new Response(corpo, {
      status: resposta.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch {
    // A caixa de conversa mostra esta mensagem ao visitante: ela precisa ser
    // honesta (a AHRI está fora do ar) e nunca virar uma tela branca.
    return new Response(JSON.stringify({ ok: false, error: 'o atendimento está fora do ar' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
