// DOWNLOAD DO CSV ÚNICO com TODOS os clientes que têm HISCON (proxy server-side)
// — o Bearer do Admin nunca chega ao browser; coberto pelo middleware de sessão.
import { API_BASE, authHeaders } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const res = await fetch(`${API_BASE}/admin/jornada/pericia/planilha-geral`, {
    cache: 'no-store',
    headers: authHeaders(),
  });
  if (!res.ok) return new Response('planilha indisponível', { status: res.status });
  const conteudo = await res.arrayBuffer();
  return new Response(conteudo, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'text/csv; charset=utf-8',
      'content-disposition':
        res.headers.get('content-disposition') ??
        'attachment; filename="contratos-todos-clientes.csv"',
    },
  });
}
