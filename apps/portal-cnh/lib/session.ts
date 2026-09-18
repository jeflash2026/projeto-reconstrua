// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO DO PAINEL CNH (2026-09-18) — login com o NOME de quem opera e a senha
// do painel (CNH_PAINEL_SENHA). O nome assina cada ação no histórico do lead.
// Cookie httpOnly: `<nome em base64url>.<HMAC-SHA256(CNH_API_TOKEN, msg:nome)>`.
// Fail-closed: sem segredo ⇒ nenhuma sessão vale.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

export const CNH_SESSION_COOKIE = 'reconstrua_cnh';
export const CNH_SESSION_MESSAGE = 'reconstrua-cnh-session-v1';

function assinatura(secret: string, nomeCodificado: string): string {
  return createHmac('sha256', secret)
    .update(`${CNH_SESSION_MESSAGE}:${nomeCodificado}`)
    .digest('hex');
}

export function cookieDeSessao(secret: string, nome: string): string {
  const codificado = Buffer.from(nome, 'utf8').toString('base64url');
  return `${codificado}.${assinatura(secret, codificado)}`;
}

/** O nome de quem está logado — null se a assinatura é inválida ou ausente. */
export function operadorDaSessao(secret: string, cookie: string): string | null {
  if (secret === '' || cookie === '') return null;
  const separador = cookie.lastIndexOf('.');
  if (separador <= 0) return null;
  const codificado = cookie.slice(0, separador);
  const a = Buffer.from(cookie.slice(separador + 1));
  const b = Buffer.from(assinatura(secret, codificado));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const nome = Buffer.from(codificado, 'base64url').toString('utf8').trim();
  return nome === '' ? null : nome;
}
