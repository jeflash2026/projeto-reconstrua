'use server';
// ─────────────────────────────────────────────────────────────────────────────
// AÇÕES do Portal do SÓCIO (Decreto 2026-07-23) — autenticação INDIVIDUAL por
// CPF: convite do Admin → o sócio cria a própria senha (confirmando o CPF) →
// login CPF+senha (a API valida no SocioAuthRuntime). O Bearer do Admin fica
// server-side; o sócio nunca o vê.
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import { cookieDeSessao, SOCIO_SESSION_COOKIE } from './session';
import { postJson } from './api';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginSocio(cpf: string, senha: string): Promise<LoginResult> {
  if (SEGREDO_SESSAO === '') {
    return { ok: false, error: 'servidor sem segredo de sessão configurado (ADMIN_API_TOKEN)' };
  }
  const r = await postJson<{ ok: boolean; cpf: string; nome: string }>('/admin/socio/login', {
    cpf: cpf.trim(),
    senha,
  });
  if (r === null || !r.ok) return { ok: false, error: 'CPF ou senha inválidos' };
  cookies().set(SOCIO_SESSION_COOKIE, cookieDeSessao(SEGREDO_SESSAO, r.cpf), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return { ok: true };
}

/** O sócio cria a PRÓPRIA senha a partir do convite do Admin, confirmando o CPF. */
export async function definirSenhaSocio(
  token: string,
  cpf: string,
  senha: string,
): Promise<LoginResult> {
  const r = await postJson<{ ok: boolean; error?: string }>('/admin/socio/definir-senha', {
    token,
    cpf: cpf.trim(),
    senha,
  });
  if (r === null) {
    return { ok: false, error: 'convite inválido/expirado ou CPF divergente — peça um novo link' };
  }
  return { ok: true };
}

// eslint-disable-next-line @typescript-eslint/require-await -- 'use server' exige async
export async function logoutSocio(): Promise<void> {
  cookies().delete(SOCIO_SESSION_COOKIE);
}
