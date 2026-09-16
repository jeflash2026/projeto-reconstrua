'use server';
// ─────────────────────────────────────────────────────────────────────────────
// AÇÕES do Portal do INVESTIDOR (2026-09-16) — autenticação INDIVIDUAL por CPF:
// convite do Admin → o investidor cria a própria senha (confirmando o CPF) →
// login CPF + senha (a API valida). O Bearer do Admin fica server-side.
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import { cookieDeSessao, INVESTIDOR_SESSION_COOKIE } from './session';
import { postJson } from './api';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

export interface ResultadoAcao {
  ok: boolean;
  error?: string;
}

export async function loginInvestidor(cpf: string, senha: string): Promise<ResultadoAcao> {
  if (SEGREDO_SESSAO === '')
    return { ok: false, error: 'servidor sem segredo de sessão configurado' };
  const r = await postJson<{ ok?: boolean; cpf?: string }>('/admin/investidor/login', {
    cpf: cpf.trim(),
    senha,
  });
  if (r?.ok !== true || typeof r.cpf !== 'string')
    return { ok: false, error: 'CPF ou senha inválidos' };
  cookies().set(INVESTIDOR_SESSION_COOKIE, cookieDeSessao(SEGREDO_SESSAO, r.cpf), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return { ok: true };
}

/** O investidor cria a PRÓPRIA senha a partir do convite, confirmando o CPF. */
export async function definirSenhaInvestidor(
  token: string,
  cpf: string,
  senha: string,
): Promise<ResultadoAcao> {
  const r = await postJson<{ ok?: boolean; error?: string }>('/admin/investidor/definir-senha', {
    token,
    cpf: cpf.trim(),
    senha,
  });
  if (r === null) return { ok: false, error: 'serviço indisponível — tente de novo em instantes' };
  if (r.ok !== true) return { ok: false, error: r.error ?? 'não foi possível criar a senha' };
  return { ok: true };
}

// eslint-disable-next-line @typescript-eslint/require-await -- 'use server' exige async
export async function logoutInvestidor(): Promise<void> {
  cookies().delete(INVESTIDOR_SESSION_COOKIE);
}
