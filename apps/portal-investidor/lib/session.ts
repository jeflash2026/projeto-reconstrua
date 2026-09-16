// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO DO PORTAL DO INVESTIDOR (2026-09-16) — login INDIVIDUAL por CPF
// (convite do Admin → senha própria → CPF + senha). Cookie httpOnly com a
// identidade assinada: `<cpf>.<HMAC-SHA256(token do Admin, msg+cpf)>`. O
// investidor nunca conhece o segredo. Fail-closed: sem segredo ⇒ sem sessão.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

export const INVESTIDOR_SESSION_COOKIE = 'reconstrua_investidor';
export const INVESTIDOR_SESSION_MESSAGE = 'reconstrua-investidor-session-v1';

export function assinaturaDeSessao(secret: string, cpf: string): string {
  return createHmac('sha256', secret).update(`${INVESTIDOR_SESSION_MESSAGE}:${cpf}`).digest('hex');
}

export function cookieDeSessao(secret: string, cpf: string): string {
  return `${cpf}.${assinaturaDeSessao(secret, cpf)}`;
}

/** CPF autenticado do cookie — null se a assinatura é inválida ou ausente. */
export function investidorDaSessao(secret: string, cookie: string): string | null {
  if (secret === '' || cookie === '') return null;
  const separador = cookie.lastIndexOf('.');
  if (separador <= 0) return null;
  const cpf = cookie.slice(0, separador);
  const a = Buffer.from(cookie.slice(separador + 1));
  const b = Buffer.from(assinaturaDeSessao(secret, cpf));
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? cpf : null;
}
