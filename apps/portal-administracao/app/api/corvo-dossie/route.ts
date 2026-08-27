// Proxy do ZIP do dossiê de integridade (Corvo) — storage privado; o browser
// nunca vê o Bearer. Download só autenticado (a página que gera o link já é).
export const dynamic = 'force-dynamic';

const API_BASE =
  process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const ADMIN_TOKEN = process.env['ADMIN_API_TOKEN'] ?? '';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cpf = url.searchParams.get('cpf') ?? '';
  const hash = url.searchParams.get('hash') ?? '';
  if (cpf === '' || hash === '') return new Response('cpf e hash obrigatórios', { status: 400 });
  const res = await fetch(
    `${API_BASE}/admin/corvo/dossies/${encodeURIComponent(cpf)}/${encodeURIComponent(hash)}/zip`,
    {
      cache: 'no-store',
      headers: ADMIN_TOKEN !== '' ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {},
    },
  );
  if (!res.ok) return new Response('dossiê indisponível', { status: res.status });
  return new Response(await res.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
    },
  });
}
