// ─────────────────────────────────────────────────────────────────────────────
// GATE DE AUTENTICAÇÃO do Portal do PERITO: visitante → /login → central.
// Valida o cookie recompondo o HMAC do segredo PRÓPRIO do perito
// (PERITO_ACCESS_SECRET) via Web Crypto. Fail-closed: sem segredo ⇒ nada abre.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'reconstrua_perito';
const SESSION_MESSAGE = 'reconstrua-perito-session-v1';

async function expectedToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(SESSION_MESSAGE));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const secret = process.env['PERITO_ACCESS_SECRET'] ?? '';
  const presented = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  if (secret !== '' && presented !== '' && presented === (await expectedToken(secret))) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

// Tudo exige sessão, exceto o login e os assets do Next ('/' explícito — lição
// do GO-LIVE-04.1 no Portal Admin).
export const config = {
  matcher: ['/', '/((?!login|_next/|favicon\\.ico).*)'],
};
