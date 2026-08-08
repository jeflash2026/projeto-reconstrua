// ─────────────────────────────────────────────────────────────────────────────
// PROXY do PAINEL JURÍDICO — o browser fala com ESTA rota; o Bearer do Admin
// fica server-side. Sessão exigida (fail-closed) em tudo, exceto o login.
//   POST /juridico/api/login          → autentica e grava os cookies
//   POST /juridico/api/sair           → encerra a sessão
//   GET/POST /juridico/api/j/<path>   → encaminha a /admin/juridico/<path>
//     (POSTs ganham `autor` = nome da sessão; anexos binários passam direto)
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import { API_BASE, authHeaders } from '../../../lib/api';
import {
  JURIDICO_NOME_COOKIE,
  JURIDICO_SESSION_COOKIE,
  cookieDeSessao,
  usuarioDaSessao,
} from '../../../lib/session';

export const dynamic = 'force-dynamic';

const SEGREDO = process.env['ADMIN_API_TOKEN'] ?? '';
const UM_MES_S = 30 * 24 * 60 * 60;

function sessaoValida(): boolean {
  const cookie = cookies().get(JURIDICO_SESSION_COOKIE)?.value ?? '';
  return usuarioDaSessao(SEGREDO, cookie) !== null;
}

function nomeDaSessao(): string {
  const nome = (cookies().get(JURIDICO_NOME_COOKIE)?.value ?? '').trim();
  return nome || 'Equipe';
}

function cookieHeader(nome: string, valor: string, maxAge: number): string {
  return `${nome}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${String(maxAge)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: { rota: string[] } },
): Promise<Response> {
  const rota = params.rota.join('/');
  if (!rota.startsWith('j/')) return Response.json({ error: 'rota desconhecida' }, { status: 404 });
  if (!sessaoValida()) return Response.json({ error: 'sessão inválida' }, { status: 401 });
  const res = await fetch(`${API_BASE}/admin/juridico/${rota.slice(2)}`, {
    cache: 'no-store',
    headers: authHeaders(),
  });
  // Anexos voltam binários — repassa o corpo e o content-type como vieram.
  const tipo = res.headers.get('content-type') ?? 'application/json';
  if (!tipo.includes('application/json')) {
    return new Response(await res.arrayBuffer(), {
      status: res.status,
      headers: {
        'content-type': tipo,
        'content-disposition': res.headers.get('content-disposition') ?? 'inline',
      },
    });
  }
  return Response.json(await res.json().catch(() => ({})), { status: res.status });
}

export async function POST(
  request: Request,
  { params }: { params: { rota: string[] } },
): Promise<Response> {
  const rota = params.rota.join('/');

  if (rota === 'login') {
    const body = (await request.json().catch(() => ({}))) as { usuario?: string; senha?: string };
    const res = await fetch(`${API_BASE}/admin/juridico/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ usuario: body.usuario, senha: body.senha }),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      nome?: string;
      error?: string;
    };
    if (!res.ok || !data.id)
      return Response.json({ error: data.error ?? 'falha no login' }, { status: res.status });
    const headers = new Headers({ 'content-type': 'application/json' });
    headers.append(
      'set-cookie',
      cookieHeader(JURIDICO_SESSION_COOKIE, cookieDeSessao(SEGREDO, data.id), UM_MES_S),
    );
    headers.append('set-cookie', cookieHeader(JURIDICO_NOME_COOKIE, data.nome ?? '', UM_MES_S));
    return new Response(JSON.stringify({ ok: true, nome: data.nome }), { status: 200, headers });
  }

  if (rota === 'sair') {
    const headers = new Headers({ 'content-type': 'application/json' });
    headers.append('set-cookie', cookieHeader(JURIDICO_SESSION_COOKIE, '', 0));
    headers.append('set-cookie', cookieHeader(JURIDICO_NOME_COOKIE, '', 0));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  if (!rota.startsWith('j/')) return Response.json({ error: 'rota desconhecida' }, { status: 404 });
  if (!sessaoValida()) return Response.json({ error: 'sessão inválida' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const res = await fetch(`${API_BASE}/admin/juridico/${rota.slice(2)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    // Cada ato é ASSINADO por quem opera (o "criado por" do original).
    body: JSON.stringify({ ...body, autor: nomeDaSessao() }),
    cache: 'no-store',
  });
  return Response.json(await res.json().catch(() => ({})), { status: res.status });
}
