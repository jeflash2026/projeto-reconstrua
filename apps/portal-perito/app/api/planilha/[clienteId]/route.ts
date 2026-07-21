// DOWNLOAD DA PLANILHA (proxy server-side) — o Bearer do Admin nunca chega ao
// browser; a rota é coberta pelo middleware de sessão do perito (fail-closed).
import { API_BASE, authHeaders } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { clienteId: string } },
): Promise<Response> {
  const res = await fetch(
    `${API_BASE}/admin/jornada/pericia/${encodeURIComponent(params.clienteId)}/planilha`,
    { cache: 'no-store', headers: authHeaders() },
  );
  if (!res.ok) return new Response('planilha indisponível', { status: res.status });
  const conteudo = await res.arrayBuffer();
  return new Response(conteudo, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'text/csv; charset=utf-8',
      'content-disposition':
        res.headers.get('content-disposition') ?? 'attachment; filename="contratos.csv"',
    },
  });
}
