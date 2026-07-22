// ─────────────────────────────────────────────────────────────────────────────
// GATE DE AUTENTICAÇÃO do Portal do Advogado: visitante → /login → painel.
// Exige a sessão (HMAC do segredo) E a identidade (advogado-id). Fail-closed.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'reconstrua_advogado';
const SESSION_MESSAGE = 'reconstrua-advogado-session-v1';

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
  const secret = process.env['ADVOGADO_API_TOKEN'] ?? '';
  const presented = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  const identidade = request.cookies.get('advogado-id')?.value ?? '';
  if (
    secret !== '' &&
    presented !== '' &&
    identidade !== '' &&
    presented === (await expectedToken(secret))
  ) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/', '/((?!login|convite|_next/|favicon\\.ico).*)'],
};
