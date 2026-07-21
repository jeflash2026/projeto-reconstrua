// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO DO PORTAL DO PERITO — mesma disciplina do Portal Admin (BL-2.1): cookie
// httpOnly com HMAC-SHA256(segredo do perito, mensagem fixa). O segredo é
// PRÓPRIO (PERITO_ACCESS_SECRET) — o perito NUNCA conhece o segredo do Admin.
// Fail-closed: sem segredo configurado ⇒ nenhum login é possível.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

export const PERITO_SESSION_COOKIE = 'reconstrua_perito';
export const PERITO_SESSION_MESSAGE = 'reconstrua-perito-session-v1';

export function peritoSessionToken(secret: string): string {
  return createHmac('sha256', secret).update(PERITO_SESSION_MESSAGE).digest('hex');
}

export function secretsMatch(presented: string, expected: string): boolean {
  if (expected === '' || presented === '') return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
