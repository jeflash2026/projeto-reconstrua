// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO DO PORTAL DO PERITO (Decreto 2026-07-21) — login INDIVIDUAL (convite do
// Admin → senha própria → ID+senha). A sessão é um cookie httpOnly com a
// identidade assinada: `<peritoId>.<HMAC-SHA256(token do Admin, msg+peritoId)>`.
// O segredo de assinatura é o Bearer que o portal JÁ possui server-side — o
// perito nunca o conhece. Fail-closed: sem segredo ⇒ nenhuma sessão é válida.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

export const PERITO_SESSION_COOKIE = 'reconstrua_perito';
export const PERITO_SESSION_MESSAGE = 'reconstrua-perito-session-v2';

export function assinaturaDeSessao(secret: string, peritoId: string): string {
  return createHmac('sha256', secret).update(`${PERITO_SESSION_MESSAGE}:${peritoId}`).digest('hex');
}

export function cookieDeSessao(secret: string, peritoId: string): string {
  return `${peritoId}.${assinaturaDeSessao(secret, peritoId)}`;
}

/** peritoId autenticado do cookie — null se assinatura inválida/ausente. */
export function peritoDaSessao(secret: string, cookie: string): string | null {
  if (secret === '' || cookie === '') return null;
  const separador = cookie.lastIndexOf('.');
  if (separador <= 0) return null;
  const peritoId = cookie.slice(0, separador);
  const assinatura = cookie.slice(separador + 1);
  const esperada = assinaturaDeSessao(secret, peritoId);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? peritoId : null;
}
