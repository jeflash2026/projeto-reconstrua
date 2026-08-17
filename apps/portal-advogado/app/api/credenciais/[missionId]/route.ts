// CREDENCIAIS DO PEDIDO ADMINISTRATIVO (decisão do dono, 2026-08-13) — proxy
// server-side: o Bearer do Advogado nunca chega ao browser; a identidade vem do
// cookie e o ISOLAMENTO real (processo atribuído a ESTE advogado) é da API,
// que também registra quem revelou a senha e quando.
//
// Rota SEPARADA da página de propósito: a senha só sai do servidor quando o
// advogado clica em "Mostrar credenciais", nunca no carregamento da tela.
import { cookies } from 'next/headers';
import { API_BASE } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { missionId: string } },
): Promise<Response> {
  const token = process.env['ADVOGADO_API_TOKEN'] ?? '';
  const id = cookies().get('advogado-id')?.value ?? '';
  if (token === '' || id === '')
    return Response.json({ error: 'não autenticado' }, { status: 401 });

  const res = await fetch(
    `${API_BASE}/advogado/processos/${encodeURIComponent(params.missionId)}/credenciais`,
    { cache: 'no-store', headers: { authorization: `Bearer ${token}`, 'x-advogado-id': id } },
  );
  return Response.json(await res.json().catch(() => ({})), {
    status: res.status,
    // Credencial não fica em cache de lugar nenhum.
    headers: { 'cache-control': 'no-store, no-cache, must-revalidate' },
  });
}
