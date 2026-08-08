// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO do PAINEL JURÍDICO (decreto 2026-08-08) — o mesmo desenho do
// humanizado: login individual (dono + sócio), cookie httpOnly com a identidade
// assinada `<usuarioId>.<HMAC(token do Admin)>`. Fail-closed.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

export const JURIDICO_SESSION_COOKIE = 'reconstrua_juridico';
export const JURIDICO_SESSION_MESSAGE = 'reconstrua-juridico-session-v1';
/** Nome de quem opera — assina cada ato ("criado por Juliano", como no
 *  original). Não é credencial: a sessão vale pelo cookie assinado. */
export const JURIDICO_NOME_COOKIE = 'reconstrua_juridico_nome';

export function assinaturaDeSessao(secret: string, usuarioId: string): string {
  return createHmac('sha256', secret)
    .update(`${JURIDICO_SESSION_MESSAGE}:${usuarioId}`)
    .digest('hex');
}

export function cookieDeSessao(secret: string, usuarioId: string): string {
  return `${usuarioId}.${assinaturaDeSessao(secret, usuarioId)}`;
}

/** usuarioId autenticado do cookie — null se assinatura inválida/ausente. */
export function usuarioDaSessao(secret: string, cookie: string): string | null {
  if (secret === '' || cookie === '') return null;
  const separador = cookie.lastIndexOf('.');
  if (separador <= 0) return null;
  const usuarioId = cookie.slice(0, separador);
  const assinatura = cookie.slice(separador + 1);
  const esperada = assinaturaDeSessao(secret, usuarioId);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? usuarioId : null;
}
