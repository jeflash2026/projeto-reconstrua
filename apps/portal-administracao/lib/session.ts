// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO DO PORTAL ADMIN — prova estateless de que o operador conhece o segredo
// de acesso (BL-2.1): cookie httpOnly com HMAC-SHA256(segredo, mensagem fixa).
// Nenhum store novo; nada além do segredo já existente. O middleware recompõe o
// mesmo HMAC (Web Crypto) e compara. Fail-closed: sem segredo ⇒ nenhum login.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'reconstrua_admin';
export const ADMIN_SESSION_MESSAGE = 'reconstrua-admin-session-v1';

/** Token de sessão derivado do segredo (determinístico; muda se o segredo mudar). */
export function adminSessionToken(secret: string): string {
  return createHmac('sha256', secret).update(ADMIN_SESSION_MESSAGE).digest('hex');
}

/** Comparação em tempo constante (mesma disciplina do requireBearer da API). */
export function secretsMatch(presented: string, expected: string): boolean {
  if (expected === '' || presented === '') return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
