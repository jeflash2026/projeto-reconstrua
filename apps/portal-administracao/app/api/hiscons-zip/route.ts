// Proxy do ZIP de HISCONs por advogado (2026-08-31) — o browser nunca vê o
// Bearer; o download passa pelo servidor do Next (mesmo padrão do corvo-dossie).
export const dynamic = 'force-dynamic';

const API_BASE =
  process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const ADMIN_TOKEN = process.env['ADMIN_API_TOKEN'] ?? '';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const advogadoId = url.searchParams.get('advogadoId') ?? '';
  if (advogadoId === '') return new Response('advogadoId obrigatório', { status: 400 });
  const res = await fetch(`${API_BASE}/admin/hiscon-lote/${encodeURIComponent(advogadoId)}/zip`, {
    cache: 'no-store',
    headers: ADMIN_TOKEN !== '' ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {},
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => '');
    return new Response(detalhe || 'pacote indisponível', { status: res.status });
  }
  return new Response(await res.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
    },
  });
}
