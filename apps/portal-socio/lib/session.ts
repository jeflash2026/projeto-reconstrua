// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO DO PORTAL DO SÓCIO (Decreto 2026-07-23) — login INDIVIDUAL por CPF
// (convite do Admin → senha própria → CPF+senha). A sessão é um cookie httpOnly
// com a identidade assinada: `<cpf>.<HMAC-SHA256(token do Admin, msg+cpf)>`.
// O segredo de assinatura é o Bearer que o portal JÁ possui server-side — o
// sócio nunca o conhece. Fail-closed: sem segredo ⇒ nenhuma sessão é válida.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SOCIO_SESSION_COOKIE = 'reconstrua_socio';
export const SOCIO_SESSION_MESSAGE = 'reconstrua-socio-session-v1';

export function assinaturaDeSessao(secret: string, cpf: string): string {
  return createHmac('sha256', secret).update(`${SOCIO_SESSION_MESSAGE}:${cpf}`).digest('hex');
}

export function cookieDeSessao(secret: string, cpf: string): string {
  return `${cpf}.${assinaturaDeSessao(secret, cpf)}`;
}

/** CPF autenticado do cookie — null se assinatura inválida/ausente. */
export function socioDaSessao(secret: string, cookie: string): string | null {
  if (secret === '' || cookie === '') return null;
  const separador = cookie.lastIndexOf('.');
  if (separador <= 0) return null;
  const cpf = cookie.slice(0, separador);
  const assinatura = cookie.slice(separador + 1);
  const esperada = assinaturaDeSessao(secret, cpf);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? cpf : null;
}
