// ANEXO DO CHAT DA EQUIPE (decreto 2026-08-05) — pré-visualização INLINE do
// arquivo recebido/enviado na conversa (foto e PDF abrem na aba). Sessão
// exigida: são documentos reais de clientes.
import { cookies } from 'next/headers';
import { API_BASE, authHeaders } from '../../../../../../lib/api';
import { HUMANIZADO_SESSION_COOKIE, operadorDaSessao } from '../../../../../../lib/session';

export const dynamic = 'force-dynamic';

const SEGREDO = process.env['ADMIN_API_TOKEN'] ?? '';

export async function GET(
  _request: Request,
  { params }: { params: { chatId: string; id: string } },
): Promise<Response> {
  const cookie = cookies().get(HUMANIZADO_SESSION_COOKIE)?.value ?? '';
  if (operadorDaSessao(SEGREDO, cookie) === null)
    return new Response('sessão inválida', { status: 401 });
  const res = await fetch(
    `${API_BASE}/admin/humanizado/chat/${encodeURIComponent(params.chatId)}/anexo/${encodeURIComponent(params.id)}`,
    { cache: 'no-store', headers: authHeaders() },
  );
  if (!res.ok) return new Response('anexo indisponível', { status: res.status });
  const conteudo = await res.arrayBuffer();
  const nome =
    /filename="([^"]*)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'anexo';
  return new Response(conteudo, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': `inline; filename="${nome}"`,
    },
  });
}
