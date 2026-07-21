// PREVIEW DE DOCUMENTO (Decreto Dossiê Pericial) — proxy SERVER-SIDE do conteúdo
// real (/admin/documents/:id/content). O token do Admin nunca chega ao browser
// (BL-2.1): o portal apresenta o Bearer aqui e devolve os bytes com o mime.
import { API_BASE } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { documentId: string } },
): Promise<Response> {
  const token = process.env['ADMIN_API_TOKEN'] ?? '';
  const res = await fetch(
    `${API_BASE}/admin/documents/${encodeURIComponent(params.documentId)}/content`,
    { cache: 'no-store', headers: token ? { authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    return new Response('documento sem conteúdo disponível', { status: res.status });
  }
  const mime = res.headers.get('content-type') ?? 'application/octet-stream';
  const bytes = await res.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    // inline: o browser abre a imagem/PDF direto (preview), sem download forçado.
    headers: { 'content-type': mime, 'content-disposition': 'inline' },
  });
}
