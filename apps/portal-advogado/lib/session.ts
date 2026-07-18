// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO DO PORTAL DO ADVOGADO — prova estateless do segredo de acesso (BL-3.1):
// cookie httpOnly com HMAC-SHA256(segredo, mensagem fixa). A IDENTIDADE
// (advogado-id) é validada no login contra o diretório (perfil ativo) e o
// ISOLAMENTO real continua no servidor, por atribuição. Fail-closed.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADVOGADO_SESSION_COOKIE = 'reconstrua_advogado';
export const ADVOGADO_SESSION_MESSAGE = 'reconstrua-advogado-session-v1';
export const ADVOGADO_ID_COOKIE = 'advogado-id';

export function advogadoSessionToken(secret: string): string {
  return createHmac('sha256', secret).update(ADVOGADO_SESSION_MESSAGE).digest('hex');
}

export function secretsMatch(presented: string, expected: string): boolean {
  if (expected === '' || presented === '') return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
