// DOWNLOAD do ZIP com UM CSV POR CLIENTE (proxy SERVER-SIDE) — o token do Admin
// nunca chega ao browser; o portal apresenta o Bearer aqui e devolve o .zip.
import { API_BASE } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const token = process.env['ADMIN_API_TOKEN'] ?? '';
  const res = await fetch(`${API_BASE}/admin/jornada/pericia/planilhas-zip`, {
    cache: 'no-store',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return new Response('pacote indisponível', { status: res.status });
  const bytes = await res.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/zip',
      'content-disposition':
        res.headers.get('content-disposition') ??
        'attachment; filename="contratos-por-cliente.zip"',
    },
  });
}
