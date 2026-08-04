'use server';
// ─────────────────────────────────────────────────────────────────────────────
// AÇÕES do Portal do ATENDIMENTO HUMANIZADO (Onda 2, 2026-07-31) — autenticação
// individual (convite do Admin → senha própria → login por CPF+senha) e o
// anexo dos 3 documentos da fase 2 (procuração assinada, RG frente e verso,
// comprovante de endereço) — o MESMO docs-equipe do Painel Admin: o advogado
// destinado baixa tudo no portal dele.
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import { cookieDeSessao, HUMANIZADO_SESSION_COOKIE, HUMANIZADO_NOME_COOKIE } from './session';
import { postJson, getJson, API_BASE, authHeaders, type DocEquipe } from './api';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginHumanizado(login: string, senha: string): Promise<LoginResult> {
  if (SEGREDO_SESSAO === '') {
    return { ok: false, error: 'servidor sem segredo de sessão configurado (ADMIN_API_TOKEN)' };
  }
  const r = await postJson<{ ok: boolean; operadorId: string; nome: string }>(
    '/admin/humanizado/login',
    { login: login.trim(), senha },
  );
  if (r === null || !r.ok) return { ok: false, error: 'credenciais inválidas' };
  const opcoes = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  };
  cookies().set(HUMANIZADO_SESSION_COOKIE, cookieDeSessao(SEGREDO_SESSAO, r.operadorId), opcoes);
  // Quem está atendendo ASSINA a mensagem pronta do WhatsApp (2026-08-04).
  cookies().set(HUMANIZADO_NOME_COOKIE, r.nome, opcoes);
  return { ok: true };
}

/** A secretária cria a PRÓPRIA senha a partir do convite do Admin. */
export async function definirSenhaHumanizado(token: string, senha: string): Promise<LoginResult> {
  const r = await postJson<{ ok: boolean; error?: string }>('/admin/humanizado/definir-senha', {
    token,
    senha,
  });
  if (r === null) {
    return { ok: false, error: 'convite inválido ou expirado — peça um novo ao escritório' };
  }
  return { ok: true };
}

// eslint-disable-next-line @typescript-eslint/require-await -- 'use server' exige async
export async function logoutHumanizado(): Promise<void> {
  cookies().delete(HUMANIZADO_SESSION_COOKIE);
  cookies().delete(HUMANIZADO_NOME_COOKIE);
}

// ── DOCS DA FASE 2 (o MESMO docs-equipe do Admin) ─────────────────────────────
export async function listarDocs(chatId: string): Promise<DocEquipe[]> {
  const r = await getJson<{ docs: DocEquipe[] }>(
    `/admin/clientes/${encodeURIComponent(chatId)}/docs-equipe`,
  );
  return r?.docs ?? [];
}

export async function anexarDoc(
  chatId: string,
  tipo: string,
  nome: string,
  base64: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await postJson<{ ok: boolean; error?: string }>(
    `/admin/clientes/${encodeURIComponent(chatId)}/docs-equipe`,
    { tipo, nome, base64 },
  );
  return r ?? { ok: false, error: 'falha no envio — tente novamente' };
}

/** Marca/desmarca "documentação enviada — aguardando o cliente devolver assinada". */
export async function marcarAguardando(chatId: string, valor: boolean): Promise<{ ok: boolean }> {
  const r = await postJson<{ ok: boolean }>(
    `/admin/humanizado/clientes/${encodeURIComponent(chatId)}/aguardando`,
    { valor },
  );
  return { ok: r?.ok === true };
}

export async function removerDoc(chatId: string, id: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(
      `${API_BASE}/admin/clientes/${encodeURIComponent(chatId)}/docs-equipe/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: authHeaders(), cache: 'no-store' },
    );
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
