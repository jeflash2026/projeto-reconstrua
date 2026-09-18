// MÍDIA do cliente (foto da carta do DETRAN, documento): o painel busca no
// cnh-api com o Bearer server-side e devolve ao navegador. Protegido pelo
// middleware (sessão do painel) e, no serviço, só serve mídia da conversa do
// próprio lead.
import { API_BASE, authHeaders } from '../../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string; mediaId: string } },
): Promise<Response> {
  const id = params.id.replace(/\D/g, '');
  try {
    const res = await fetch(
      `${API_BASE}/cnh-api/admin/leads/${id}/midia/${encodeURIComponent(params.mediaId)}`,
      { headers: authHeaders(), cache: 'no-store', signal: AbortSignal.timeout(30_000) },
    );
    if (!res.ok) return new Response('Mídia indisponível', { status: res.status });
    return new Response(await res.arrayBuffer(), {
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
        'cache-control': 'private, max-age=300',
      },
    });
  } catch {
    return new Response('Serviço da CNH indisponível', { status: 502 });
  }
}
