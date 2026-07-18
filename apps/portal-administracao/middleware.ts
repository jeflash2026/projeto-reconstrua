// ─────────────────────────────────────────────────────────────────────────────
// GATE DE AUTENTICAÇÃO do Portal Admin (cobre também /pericias, que o NPM serve
// via /admin/pericias): visitante → /login → painel. NUNCA abre o painel direto.
// Valida o cookie de sessão recompondo o HMAC do segredo via Web Crypto (runtime
// do middleware). Fail-closed: segredo ausente ⇒ nenhum cookie é válido.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'reconstrua_admin';
const SESSION_MESSAGE = 'reconstrua-admin-session-v1';

async function expectedToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(SESSION_MESSAGE));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const secret = process.env['ADMIN_API_TOKEN'] ?? '';
  const presented = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  if (secret !== '' && presented !== '' && presented === (await expectedToken(secret))) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

// Tudo exige sessão, exceto o login e os assets do Next.
export const config = {
  matcher: ['/((?!login|_next/|favicon\\.ico).*)'],
};
