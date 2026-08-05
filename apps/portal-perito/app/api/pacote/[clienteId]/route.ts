// DOWNLOAD DO PACOTE COMPLETO (decreto 2026-08-04) — planilha (guia v2) + os
// documentos do pedido administrativo (procuração assinada, RG, comprovante e
// originais do cliente) num ZIP. Proxy server-side: o Bearer do Admin nunca
// chega ao browser; a rota é coberta pelo middleware de sessão do perito.
import { API_BASE, authHeaders } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { clienteId: string } },
): Promise<Response> {
  const res = await fetch(
    `${API_BASE}/admin/jornada/pericia/${encodeURIComponent(params.clienteId)}/pacote`,
    { cache: 'no-store', headers: authHeaders() },
  );
  if (!res.ok) return new Response('pacote indisponível', { status: res.status });
  const conteudo = await res.arrayBuffer();
  return new Response(conteudo, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/zip',
      'content-disposition':
        res.headers.get('content-disposition') ?? 'attachment; filename="pacote.zip"',
    },
  });
}
