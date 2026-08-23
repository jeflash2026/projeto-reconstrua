// DOWNLOAD do LOTE COMPLETO (2026-08-12) — um ZIP com uma PASTA POR CLIENTE:
// planilha de contratos + procuração assinada, RG, comprovante e os originais.
// Substitui o antigo `planilhas-zip` no botão "Baixar TODOS", que descia só os
// CSV e deixava o perito sem os documentos para protocolar.
// Proxy server-side: o Bearer do Admin nunca chega ao browser.
import { API_BASE, authHeaders } from '../../../lib/api';

export const dynamic = 'force-dynamic';
/** Montar o pacote de dezenas de clientes (com anexos) leva mais que o padrão. */
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  // Os ids EXATOS da fila "aguardando" (2026-08-19): sem eles a API empacotava
  // todos os aptos — inclusive os já em perícia — e o proxy cortava por tempo.
  const ids = new URL(request.url).searchParams.get('ids') ?? '';
  const res = await fetch(
    `${API_BASE}/admin/jornada/pericia/pacotes-zip?ids=${encodeURIComponent(ids)}`,
    {
      cache: 'no-store',
      headers: authHeaders(),
    },
  );
  if (!res.ok) return new Response('pacote indisponível', { status: res.status });
  const conteudo = await res.arrayBuffer();
  return new Response(conteudo, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/zip',
      'content-disposition':
        res.headers.get('content-disposition') ?? 'attachment; filename="pacotes-do-perito.zip"',
    },
  });
}
