// ─────────────────────────────────────────────────────────────────────────────
// GATE DE AUTENTICAÇÃO do Painel CNH (2026-09-18): visitante → /login →
// painel. O cookie carrega `<nome>.<HMAC>`; o middleware recompõe o HMAC (Web
// Crypto) com o segredo server-side. Fail-closed: sem segredo ⇒ nada abre.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'reconstrua_cnh';
const SESSION_MESSAGE = 'reconstrua-cnh-session-v1';

async function assinatura(secret: string, nomeCodificado: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${SESSION_MESSAGE}:${nomeCodificado}`),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const secret = process.env['CNH_API_TOKEN'] ?? '';
  const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  const separador = cookie.lastIndexOf('.');
  if (secret !== '' && separador > 0) {
    const nome = cookie.slice(0, separador);
    if (cookie.slice(separador + 1) === (await assinatura(secret, nome))) {
      return NextResponse.next();
    }
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

// Tudo exige sessão, exceto o login e os assets ('/' explícito).
export const config = {
  matcher: ['/', '/((?!login|_next/|icone\\.png|favicon\\.ico).*)'],
};
