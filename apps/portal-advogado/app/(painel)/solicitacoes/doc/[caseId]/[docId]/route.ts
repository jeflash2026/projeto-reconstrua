// 15C-2 — "Abrir documento": proxy autenticado (server-side) para o conteúdo do
// documento no API do advogado. O link é copiável/compartilhável dentro do portal.
import { NextResponse } from 'next/server';
import { API_BASE, advogadoId } from '../../../../../../lib/api';

export async function GET(
  _req: Request,
  { params }: { params: { caseId: string; docId: string } },
): Promise<Response> {
  const id = advogadoId();
  const token = process.env['ADVOGADO_API_TOKEN'] ?? '';
  const headers: Record<string, string> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  if (id) headers['x-advogado-id'] = id;
  const upstream = await fetch(
    `${API_BASE}/advogado/processos/${encodeURIComponent(params.caseId)}/documentos/${encodeURIComponent(params.docId)}/content`,
    { headers, cache: 'no-store' },
  ).catch(() => null);
  if (!upstream || !upstream.ok) {
    return NextResponse.json(
      { error: 'documento indisponível' },
      { status: upstream?.status ?? 502 },
    );
  }
  return new Response(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': upstream.headers.get('content-disposition') ?? 'inline',
    },
  });
}
