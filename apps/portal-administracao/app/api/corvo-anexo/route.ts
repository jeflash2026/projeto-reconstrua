// Proxy do ANEXO de resposta de banco (integração Corvo) — o browser não fala
// com a API interna nem vê o Bearer; o Next busca e repassa os bytes.
export const dynamic = 'force-dynamic';

const API_BASE =
  process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const ADMIN_TOKEN = process.env['ADMIN_API_TOKEN'] ?? '';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const respostaId = url.searchParams.get('respostaId') ?? '';
  const indice = url.searchParams.get('indice') ?? '0';
  if (respostaId === '') return new Response('respostaId obrigatório', { status: 400 });
  const res = await fetch(
    `${API_BASE}/admin/corvo/respostas/${encodeURIComponent(respostaId)}/anexo/${encodeURIComponent(indice)}`,
    {
      cache: 'no-store',
      headers: ADMIN_TOKEN !== '' ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {},
    },
  );
  if (!res.ok) return new Response('anexo indisponível', { status: res.status });
  return new Response(await res.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
    },
  });
}
