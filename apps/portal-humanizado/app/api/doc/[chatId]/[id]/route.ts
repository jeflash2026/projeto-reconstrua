// PRÉ-VISUALIZAÇÃO DO DOCUMENTO ANEXADO (pedido do dono, 2026-08-04) — a
// secretária confere se anexou o arquivo CERTO sem baixar: o proxy busca o
// conteúdo na API do Admin (Bearer server-side, nunca no browser) e devolve
// INLINE — foto e PDF abrem direto na aba. O middleware de sessão cobre a rota.
import { API_BASE, authHeaders } from '../../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { chatId: string; id: string } },
): Promise<Response> {
  const res = await fetch(
    `${API_BASE}/admin/clientes/${encodeURIComponent(params.chatId)}/docs-equipe/${encodeURIComponent(params.id)}/content`,
    { cache: 'no-store', headers: authHeaders() },
  );
  if (!res.ok) return new Response('documento indisponível', { status: res.status });
  const conteudo = await res.arrayBuffer();
  // "attachment" da API vira "inline": o navegador PRÉ-VISUALIZA em vez de
  // baixar (o nome original é preservado para quem quiser salvar).
  const nome =
    /filename="([^"]*)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'documento';
  return new Response(conteudo, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': `inline; filename="${nome}"`,
    },
  });
}
