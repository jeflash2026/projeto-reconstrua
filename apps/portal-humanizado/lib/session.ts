// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO do Portal do ATENDIMENTO HUMANIZADO (Onda 2, 2026-07-31) — o MESMO
// desenho do perito: login individual (convite do Admin → senha própria), cookie
// httpOnly com a identidade assinada `<operadorId>.<HMAC(token do Admin)>`.
// Fail-closed: sem segredo ⇒ nenhuma sessão é válida.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

export const HUMANIZADO_SESSION_COOKIE = 'reconstrua_humanizado';
export const HUMANIZADO_SESSION_MESSAGE = 'reconstrua-humanizado-session-v1';
/** O NOME de quem está atendendo (2026-08-04) — a mensagem pronta do WhatsApp
 *  é assinada por quem a envia. Gravado no login (o próprio Auth já devolve o
 *  nome); ausente ⇒ a assinatura cai no nome da equipe. Não é credencial: só
 *  identifica quem escreve, e a sessão continua valendo pelo cookie assinado. */
export const HUMANIZADO_NOME_COOKIE = 'reconstrua_humanizado_nome';

export function assinaturaDeSessao(secret: string, operadorId: string): string {
  return createHmac('sha256', secret)
    .update(`${HUMANIZADO_SESSION_MESSAGE}:${operadorId}`)
    .digest('hex');
}

export function cookieDeSessao(secret: string, operadorId: string): string {
  return `${operadorId}.${assinaturaDeSessao(secret, operadorId)}`;
}

/** operadorId autenticado do cookie — null se assinatura inválida/ausente. */
export function operadorDaSessao(secret: string, cookie: string): string | null {
  if (secret === '' || cookie === '') return null;
  const separador = cookie.lastIndexOf('.');
  if (separador <= 0) return null;
  const operadorId = cookie.slice(0, separador);
  const assinatura = cookie.slice(separador + 1);
  const esperada = assinaturaDeSessao(secret, operadorId);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? operadorId : null;
}
