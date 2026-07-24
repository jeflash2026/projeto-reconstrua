// DOWNLOAD do ZIP com UM CSV POR CLIENTE (proxy server-side) — o Bearer do Admin
// nunca chega ao browser; coberto pelo middleware de sessão do perito.
import { API_BASE, authHeaders } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const res = await fetch(`${API_BASE}/admin/jornada/pericia/planilhas-zip`, {
    cache: 'no-store',
    headers: authHeaders(),
  });
  if (!res.ok) return new Response('pacote indisponível', { status: res.status });
  const conteudo = await res.arrayBuffer();
  return new Response(conteudo, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/zip',
      'content-disposition':
        res.headers.get('content-disposition') ??
        'attachment; filename="contratos-por-cliente.zip"',
    },
  });
}
