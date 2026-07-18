// ─────────────────────────────────────────────────────────────────────────────
// TOKEN DE ACESSO DO CLIENTE (PC-R1) — o "link mágico" é uma EXTENSÃO TEMPORÁRIA
// da identidade primária (o WhatsApp — Decisão 4). Stateless: payload assinado
// (HMAC-SHA256) com validade embutida; sobrevive a qualquer restart (Lei 13);
// escopo = 1 cliente. Renovação SEMPRE por conversa com a AHRI — nunca
// "esqueci minha senha". Nenhuma persistência.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto';

interface TokenPayload {
  readonly c: string; // clienteId
  readonly exp: number; // epoch ms
}

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('hex');
}

/** Emite o token do cliente (validade em dias; determinístico dados os insumos). */
export function emitirTokenCliente(clienteId: string, validadeDias: number, now: Date, secret: string): string {
  const payload: TokenPayload = { c: clienteId, exp: now.getTime() + validadeDias * 24 * 60 * 60 * 1000 };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${b64}.${sign(b64, secret)}`;
}

/**
 * Valida o token: assinatura em tempo constante + expiração. Retorna o clienteId
 * ou null. FAIL-CLOSED: segredo vazio ⇒ nenhum token é válido.
 */
export function validarTokenCliente(token: string, now: Date, secret: string): string | null {
  if (secret === '' || token === '') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const b64 = token.slice(0, dot);
  const presented = token.slice(dot + 1);
  const expected = sign(b64, secret);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as Partial<TokenPayload>;
    if (typeof parsed.c !== 'string' || parsed.c === '' || typeof parsed.exp !== 'number') return null;
    if (now.getTime() > parsed.exp) return null; // expirado → peça novo link à AHRI
    return parsed.c;
  } catch {
    return null;
  }
}
