'use server';
// ─────────────────────────────────────────────────────────────────────────────
// AÇÕES do Portal do PERITO — login com o segredo PRÓPRIO (PERITO_ACCESS_SECRET)
// e a confirmação dos pedidos administrativos (o ÚNICO fato que o perito grava;
// a partir dele nasce a contagem regressiva dos 10 dias — Jornada B, B-R3).
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import { peritoSessionToken, secretsMatch, PERITO_SESSION_COOKIE } from './session';
import { postJson } from './api';

const PERITO_SECRET = process.env['PERITO_ACCESS_SECRET'] ?? '';

export interface LoginResult {
  ok: boolean;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/require-await -- 'use server' exige async
export async function loginPerito(senha: string): Promise<LoginResult> {
  if (PERITO_SECRET === '') {
    return {
      ok: false,
      error: 'servidor sem segredo do perito configurado (PERITO_ACCESS_SECRET)',
    };
  }
  if (!secretsMatch(senha.trim(), PERITO_SECRET)) {
    return { ok: false, error: 'senha de acesso incorreta' };
  }
  cookies().set(PERITO_SESSION_COOKIE, peritoSessionToken(PERITO_SECRET), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return { ok: true };
}

// eslint-disable-next-line @typescript-eslint/require-await -- 'use server' exige async
export async function logoutPerito(): Promise<void> {
  cookies().delete(PERITO_SESSION_COOKIE);
}

/** Confirma os pedidos administrativos do cliente ⇒ inicia os 10 dias. */
export async function confirmarPedidos(clienteId: string): Promise<{ ok: boolean }> {
  const r = await postJson<{ ok?: boolean }>(
    `/admin/jornada/pericia/${encodeURIComponent(clienteId)}/confirmar-pedidos`,
    { confirmadoPor: 'perito-portal' },
  );
  return { ok: r !== null };
}
