// ─────────────────────────────────────────────────────────────────────────────
// GATE DE AUTENTICAÇÃO do Portal do PERITO (Decreto 2026-07-21): visitante →
// /login → central. O cookie carrega `<peritoId>.<HMAC>`; o middleware recompõe
// o HMAC (Web Crypto) com o segredo server-side. Fail-closed: sem segredo ⇒
// nenhum cookie é válido. /convite é público (o link do Admin cria a senha).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'reconstrua_perito';
const SESSION_MESSAGE = 'reconstrua-perito-session-v2';

async function assinatura(secret: string, peritoId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${SESSION_MESSAGE}:${peritoId}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const secret = process.env['ADMIN_API_TOKEN'] ?? '';
  const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  const separador = cookie.lastIndexOf('.');
  if (secret !== '' && separador > 0) {
    const peritoId = cookie.slice(0, separador);
    const presented = cookie.slice(separador + 1);
    if (presented === (await assinatura(secret, peritoId))) {
      return NextResponse.next();
    }
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

// Tudo exige sessão, exceto login, convite e assets ('/' explícito — lição
// do GO-LIVE-04.1 no Portal Admin).
export const config = {
  matcher: ['/', '/((?!login|convite|_next/|favicon\\.ico).*)'],
};
