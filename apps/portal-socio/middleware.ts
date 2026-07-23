// ─────────────────────────────────────────────────────────────────────────────
// GATE DE AUTENTICAÇÃO do Portal do SÓCIO (Decreto 2026-07-23): visitante →
// /login → painel. O cookie carrega `<cpf>.<HMAC>`; o middleware recompõe o HMAC
// (Web Crypto) com o segredo server-side. Fail-closed: sem segredo ⇒ nenhum
// cookie é válido. /convite é público (o link do Admin cria a senha).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'reconstrua_socio';
const SESSION_MESSAGE = 'reconstrua-socio-session-v1';

async function assinatura(secret: string, cpf: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${SESSION_MESSAGE}:${cpf}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const secret = process.env['ADMIN_API_TOKEN'] ?? '';
  const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  const separador = cookie.lastIndexOf('.');
  if (secret !== '' && separador > 0) {
    const cpf = cookie.slice(0, separador);
    const presented = cookie.slice(separador + 1);
    if (presented === (await assinatura(secret, cpf))) {
      return NextResponse.next();
    }
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

// Tudo exige sessão, exceto login, convite e assets ('/' explícito).
export const config = {
  matcher: ['/', '/((?!login|convite|_next/|favicon\\.ico).*)'],
};
