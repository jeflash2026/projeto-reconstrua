'use server';
// ─────────────────────────────────────────────────────────────────────────────
// AÇÕES do Portal do PERITO (Decreto 2026-07-21) — autenticação INDIVIDUAL:
// convite do Admin → o perito cria a própria senha → login ID+senha (a API
// valida no Auth Runtime; papel 'perito'). E a confirmação dos pedidos
// administrativos — o ato que inicia a contagem dos 10 dias (Jornada B, B-R3).
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import { cookieDeSessao, PERITO_SESSION_COOKIE } from './session';
import { postJson } from './api';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginPerito(peritoId: string, senha: string): Promise<LoginResult> {
  if (SEGREDO_SESSAO === '') {
    return { ok: false, error: 'servidor sem segredo de sessão configurado (ADMIN_API_TOKEN)' };
  }
  const r = await postJson<{ ok: boolean; peritoId: string; nome: string }>('/admin/perito/login', {
    peritoId: peritoId.trim(),
    senha,
  });
  if (r === null || !r.ok) return { ok: false, error: 'credenciais inválidas' };
  cookies().set(PERITO_SESSION_COOKIE, cookieDeSessao(SEGREDO_SESSAO, r.peritoId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return { ok: true };
}

/** O perito cria a PRÓPRIA senha a partir do convite do Admin. */
export async function definirSenhaPerito(token: string, senha: string): Promise<LoginResult> {
  const r = await postJson<{ ok: boolean; error?: string }>('/admin/perito/definir-senha', {
    token,
    senha,
  });
  if (r === null) {
    return { ok: false, error: 'convite inválido ou expirado — peça um novo ao escritório' };
  }
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

// ── FLUXO DA PERÍCIA (Decreto 2026-07-24) ────────────────────────────────────
/** Baixou o estudo ⇒ entra em perícia (10 dias começam). Idempotente. */
export async function iniciarPericia(
  chatId: string,
  clienteId: string,
  quem: string,
): Promise<{ ok: boolean }> {
  const r = await postJson<{ ok?: boolean }>(
    `/admin/jornada/pericia/${encodeURIComponent(chatId)}/iniciar`,
    { clienteId, quem },
  );
  return { ok: r !== null };
}

/** Inicia a perícia de TODOS os aguardando de uma vez (o "baixar todos"). */
export async function iniciarPericiaTodos(
  itens: readonly { chatId: string; clienteId: string; quem: string }[],
): Promise<{ ok: boolean; novos: number }> {
  const r = await postJson<{ novos?: number }>('/admin/jornada/pericia/iniciar-todos', { itens });
  return { ok: r !== null, novos: r?.novos ?? 0 };
}

export async function salvarCredenciais(
  chatId: string,
  email: string,
  senha: string,
  provedor: string,
): Promise<{ ok: boolean }> {
  const r = await postJson<{ ok?: boolean }>(
    `/admin/jornada/pericia/${encodeURIComponent(chatId)}/credenciais`,
    { email, senha, provedor },
  );
  return { ok: r !== null };
}

export async function salvarRespostaBanco(chatId: string, texto: string): Promise<{ ok: boolean }> {
  const r = await postJson<{ ok?: boolean }>(
    `/admin/jornada/pericia/${encodeURIComponent(chatId)}/resposta-banco`,
    { texto },
  );
  return { ok: r !== null };
}
