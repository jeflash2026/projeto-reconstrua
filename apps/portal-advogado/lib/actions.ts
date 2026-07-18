'use server';
// Server Actions (BL-3.2): a ESCRITA do advogado (registrar atividade jurídica) roda
// no SERVIDOR do Next — onde o segredo (ADVOGADO_API_TOKEN) e a rede da API interna
// existem, e a identidade (x-advogado-id) é lida server-side via cookies(). O browser
// nunca fala direto com a API nem vê o segredo. Reutiliza `lib/api` (BL-3.1) sem
// alterar a autenticação, o isolamento por atribuição, nem a persistência.
import { cookies } from 'next/headers';
import { API_BASE, sendJson } from './api';
import {
  advogadoSessionToken,
  secretsMatch,
  ADVOGADO_ID_COOKIE,
  ADVOGADO_SESSION_COOKIE,
} from './session';

// ── AUTENTICAÇÃO (visitante → login → painel) ─────────────────────────────────
// Login = segredo de acesso (BL-3.1) + ID do advogado (fornecido pelo Admin ao
// cadastrá-lo em /admin/advogados). A identidade é VALIDADA contra o diretório
// (perfil precisa existir e estar ATIVO) antes de abrir a sessão.
const ADVOGADO_TOKEN_LOGIN = process.env['ADVOGADO_API_TOKEN'] ?? '';

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginAdvogado(senha: string, advogadoId: string): Promise<LoginResult> {
  if (ADVOGADO_TOKEN_LOGIN === '') return { ok: false, error: 'servidor sem segredo de acesso configurado (ADVOGADO_ACCESS_SECRET)' };
  if (!secretsMatch(senha.trim(), ADVOGADO_TOKEN_LOGIN)) return { ok: false, error: 'senha de acesso incorreta' };
  const id = advogadoId.trim();
  if (id === '') return { ok: false, error: 'informe o seu ID de advogado' };

  // Identidade validada no servidor: perfil existente e ATIVO (401 caso contrário).
  try {
    const res = await fetch(`${API_BASE}/advogado/perfil`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${ADVOGADO_TOKEN_LOGIN}`, 'x-advogado-id': id },
    });
    if (!res.ok) return { ok: false, error: 'advogado não encontrado ou inativo (confira o ID com o Administrador)' };
  } catch {
    return { ok: false, error: 'API indisponível' };
  }

  const opts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 };
  cookies().set(ADVOGADO_SESSION_COOKIE, advogadoSessionToken(ADVOGADO_TOKEN_LOGIN), opts);
  cookies().set(ADVOGADO_ID_COOKIE, id, opts);
  return { ok: true };
}

export async function logoutAdvogado(): Promise<void> {
  cookies().delete(ADVOGADO_SESSION_COOKIE);
  cookies().delete(ADVOGADO_ID_COOKIE);
  return Promise.resolve(); // server action: assinatura async exigida
}

export interface AhriDecision {
  informed: boolean;
  decidedToSpeak: boolean;
  ruleRefs: string[];
}

export interface ActivityResult {
  ahri: AhriDecision;
}

export async function registerActivity(
  missionId: string,
  kind: string,
  text: string,
  dueAt: string | null,
): Promise<ActivityResult | null> {
  return sendJson<ActivityResult>('POST', `/advogado/processos/${missionId}/atividades`, {
    kind,
    text,
    ...(dueAt !== null ? { dueAt } : {}),
  });
}
