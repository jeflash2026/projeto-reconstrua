// RELATÓRIO DO DOSSIÊ, SEM O PACOTE (2026-10-06) — o documento de leitura que o
// advogado junta ao processo. Caso REAL: a advogada tinha os três dossiês, abriu
// os .eml soltos e concluiu que o documento não existia; ele estava dentro de um
// ZIP de 40 MB e a tela só oferecia o download do pacote. Agora abre em uma aba
// e imprime como PDF direto do navegador. O ZIP continua disponível ao lado,
// para quem precisar da prova bruta (.eml e logs do servidor de saída).
//
// Proxy server-side, igual ao do ZIP: o Bearer nunca chega ao browser e o
// isolamento por atribuição é da API (o CPF sai do chat da missão — hash de
// outro cliente responde 404).
import { cookies } from 'next/headers';
import { API_BASE } from '../../../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { missionId: string; hashRaiz: string } },
): Promise<Response> {
  const token = process.env['ADVOGADO_API_TOKEN'] ?? '';
  const id = cookies().get('advogado-id')?.value ?? '';
  if (token === '' || id === '') return new Response('não autenticado', { status: 401 });

  const res = await fetch(
    `${API_BASE}/advogado/processos/${encodeURIComponent(params.missionId)}/dossie-corvo/${encodeURIComponent(params.hashRaiz)}/relatorio`,
    {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, 'x-advogado-id': id },
    },
  );
  if (!res.ok) return new Response('relatório indisponível', { status: res.status });

  // O HTML vem do Corvo e é auto-contido (texto, tabelas e CSS). Repetimos aqui
  // a política restritiva da API: nada executa no navegador do advogado.
  return new Response(await res.text(), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
      'x-content-type-options': 'nosniff',
    },
  });
}
