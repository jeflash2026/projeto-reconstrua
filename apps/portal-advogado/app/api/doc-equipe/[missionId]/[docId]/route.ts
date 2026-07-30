// DOWNLOAD DE DOCUMENTO DA EQUIPE (decreto 2026-07-30) — procuração assinada,
// RG e comprovante colhidos pelo time humano e anexados no Painel Admin.
// Proxy server-side: Bearer nunca chega ao browser; o isolamento por
// atribuição é da API. Coberta pelo middleware de sessão do portal.
import { cookies } from 'next/headers';
import { API_BASE } from '../../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { missionId: string; docId: string } },
): Promise<Response> {
  const token = process.env['ADVOGADO_API_TOKEN'] ?? '';
  const id = cookies().get('advogado-id')?.value ?? '';
  if (token === '' || id === '') return new Response('não autenticado', { status: 401 });

  const res = await fetch(
    `${API_BASE}/advogado/processos/${encodeURIComponent(params.missionId)}/docs-equipe/${encodeURIComponent(params.docId)}/content`,
    {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, 'x-advogado-id': id },
    },
  );
  if (!res.ok) return new Response('documento indisponível', { status: res.status });

  const conteudo = await res.arrayBuffer();
  return new Response(conteudo, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition':
        res.headers.get('content-disposition') ?? 'attachment; filename="documento"',
    },
  });
}
