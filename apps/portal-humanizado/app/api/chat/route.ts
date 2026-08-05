// LISTA DE CONVERSAS do canal da equipe (decreto 2026-08-05) — alimenta o
// painel Conversas (estilo WhatsApp) com polling. Sessão exigida (fail-closed).
import { cookies } from 'next/headers';
import { API_BASE, authHeaders } from '../../../lib/api';
import { HUMANIZADO_SESSION_COOKIE, operadorDaSessao } from '../../../lib/session';

export const dynamic = 'force-dynamic';

const SEGREDO = process.env['ADMIN_API_TOKEN'] ?? '';

export async function GET(): Promise<Response> {
  const cookie = cookies().get(HUMANIZADO_SESSION_COOKIE)?.value ?? '';
  if (operadorDaSessao(SEGREDO, cookie) === null)
    return Response.json({ error: 'sessão inválida' }, { status: 401 });
  const res = await fetch(`${API_BASE}/admin/humanizado/chat`, {
    cache: 'no-store',
    headers: authHeaders(),
  });
  return Response.json(await res.json().catch(() => ({})), { status: res.status });
}
