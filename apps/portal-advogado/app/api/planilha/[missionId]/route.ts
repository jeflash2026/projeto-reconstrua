// PLANILHA DE CONTRATOS DO CLIENTE (decreto 2026-07-30) — proxy server-side:
// a MESMA planilha do perito (CSV Excel-BR; contrato EXATO como no HISCON),
// agora para o advogado do processo. Bearer nunca chega ao browser; o
// isolamento por atribuição é da API. Coberta pelo middleware de sessão.
import { cookies } from 'next/headers';
import { API_BASE } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { missionId: string } },
): Promise<Response> {
  const token = process.env['ADVOGADO_API_TOKEN'] ?? '';
  const id = cookies().get('advogado-id')?.value ?? '';
  if (token === '' || id === '') return new Response('não autenticado', { status: 401 });

  const res = await fetch(
    `${API_BASE}/advogado/processos/${encodeURIComponent(params.missionId)}/planilha`,
    {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, 'x-advogado-id': id },
    },
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
