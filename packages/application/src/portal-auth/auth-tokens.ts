// ─────────────────────────────────────────────────────────────────────────────
// AUTH RUNTIME COMPARTILHADO (GO-LIVE-04) · TOKENS ASSINADOS — o MESMO desenho
// do link mágico do cliente (PC-R3), generalizado para QUALQUER portal: payload
// {sub, uso, exp} + HMAC-SHA256. O `uso` isola contextos (convite-advogado,
// convite-perito, ...): um token nunca vale fora do seu propósito. Fail-closed:
// segredo vazio, assinatura errada, uso errado ou expirado ⇒ null.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

function assinar(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Emite um token assinado para um sujeito e um USO específico. */
export function assinarTokenPortal(sub: string, uso: string, validadeDias: number, now: Date, secret: string): string {
  const exp = now.getTime() + validadeDias * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ s: sub, u: uso, exp }), 'utf8').toString('base64url');
  return `${payload}.${assinar(payload, secret)}`;
}

/** Valida token/uso/expiração. Devolve o sujeito ou null (nunca lança). */
export function validarTokenPortal(token: string, uso: string, now: Date, secret: string): string | null {
  if (secret === '' || token === '') return null;
  const [payload, mac] = token.split('.');
  if (payload === undefined || mac === undefined || payload === '' || mac === '') return null;
  const esperado = assinar(payload, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { s?: string; u?: string; exp?: number };
    if (typeof parsed.s !== 'string' || parsed.s === '') return null;
    if (parsed.u !== uso) return null;
    if (typeof parsed.exp !== 'number' || now.getTime() > parsed.exp) return null;
    return parsed.s;
  } catch {
    return null;
  }
}
