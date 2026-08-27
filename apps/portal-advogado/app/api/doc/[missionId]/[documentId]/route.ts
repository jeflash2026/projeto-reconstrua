// DOWNLOAD DO DOCUMENTO DO CLIENTE (decreto 2026-07-29) — proxy server-side:
// o Bearer do Advogado nunca chega ao browser; a identidade vem do cookie e o
// ISOLAMENTO real (processo atribuído + documento do processo) é da API. A
// rota é coberta pelo middleware de sessão do portal (fail-closed).
import { cookies } from 'next/headers';
import { API_BASE } from '../../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { missionId: string; documentId: string } },
): Promise<Response> {
  const token = process.env['ADVOGADO_API_TOKEN'] ?? '';
  const id = cookies().get('advogado-id')?.value ?? '';
  if (token === '' || id === '') return new Response('não autenticado', { status: 401 });

  const res = await fetch(
    `${API_BASE}/advogado/processos/${encodeURIComponent(params.missionId)}/documentos/${encodeURIComponent(params.documentId)}/content`,
    {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, 'x-advogado-id': id },
    },
  );
  if (!res.ok) {
    // O MOTIVO real da API chega ao advogado (caso Cynthia, 2026-08-27): antes
    // qualquer falha virava "documento indisponível" e ninguém sabia o porquê.
    const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
    return new Response(corpo?.error ?? 'documento indisponível', { status: res.status });
  }

  // Nome do arquivo (?f=) saneado — só ASCII seguro no content-disposition.
  const nomeBruto = new URL(request.url).searchParams.get('f') ?? `documento-${params.documentId}`;
  const nome = nomeBruto.replace(/[^\w.\-() ]+/g, '_').slice(0, 120) || 'documento';

  const conteudo = await res.arrayBuffer();
  return new Response(conteudo, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': `attachment; filename="${nome}"`,
    },
  });
}
