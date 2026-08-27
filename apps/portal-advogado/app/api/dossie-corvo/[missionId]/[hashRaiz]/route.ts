// DOWNLOAD DO DOSSIÊ DE INTEGRIDADE (Corvo, 2026-08-27) — o pacote de prova da
// cadeia de envio aos bancos, para o advogado juntar ao processo. Proxy
// server-side: Bearer nunca chega ao browser; o isolamento por atribuição é da
// API (o CPF é resolvido pelo chat da missão — hash de outro cliente dá 404).
import { cookies } from 'next/headers';
import { API_BASE } from '../../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { missionId: string; hashRaiz: string } },
): Promise<Response> {
  const token = process.env['ADVOGADO_API_TOKEN'] ?? '';
  const id = cookies().get('advogado-id')?.value ?? '';
  if (token === '' || id === '') return new Response('não autenticado', { status: 401 });

  const res = await fetch(
    `${API_BASE}/advogado/processos/${encodeURIComponent(params.missionId)}/dossie-corvo/${encodeURIComponent(params.hashRaiz)}/zip`,
    {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, 'x-advogado-id': id },
    },
  );
  if (!res.ok) return new Response('dossiê indisponível', { status: res.status });

  return new Response(await res.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition':
        res.headers.get('content-disposition') ?? 'attachment; filename="dossie.zip"',
    },
  });
}
