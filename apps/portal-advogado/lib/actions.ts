'use server';
// Server Actions (BL-3.2): a ESCRITA do advogado (registrar atividade jurídica) roda
// no SERVIDOR do Next — onde o segredo (ADVOGADO_API_TOKEN) e a rede da API interna
// existem, e a identidade (x-advogado-id) é lida server-side via cookies(). O browser
// nunca fala direto com a API nem vê o segredo. Reutiliza `lib/api` (BL-3.1) sem
// alterar a autenticação, o isolamento por atribuição, nem a persistência.
import { cookies } from 'next/headers';
import { API_BASE, sendJson } from './api';
import { advogadoSessionToken, ADVOGADO_ID_COOKIE, ADVOGADO_SESSION_COOKIE } from './session';

// ── AUTENTICAÇÃO (GO-LIVE-04: convite → senha INDIVIDUAL → login → sessão) ────
// A senha global de transporte (segredo do portal) NÃO autentica mais pessoas:
// cada advogado tem credencial própria, criada a partir do convite do escritório.
// O Auth Runtime compartilhado (application) decide; aqui só transporte + sessão.
const ADVOGADO_TOKEN_LOGIN = process.env['ADVOGADO_API_TOKEN'] ?? '';

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginAdvogado(advogadoId: string, senha: string): Promise<LoginResult> {
  if (ADVOGADO_TOKEN_LOGIN === '')
    return {
      ok: false,
      error: 'servidor sem segredo de acesso configurado (ADVOGADO_ACCESS_SECRET)',
    };
  const id = advogadoId.trim();
  if (id === '' || senha === '') return { ok: false, error: 'informe o seu ID e a sua senha' };

  // Credencial INDIVIDUAL validada pelo Auth Runtime (erro único; fail-closed).
  try {
    const res = await fetch(`${API_BASE}/advogado-auth/login`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ADVOGADO_TOKEN_LOGIN}`,
      },
      body: JSON.stringify({ advogadoId: id, senha }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 401 ? 'credenciais inválidas' : 'falha na autenticação — tente novamente',
      };
    }
  } catch {
    return { ok: false, error: 'API indisponível' };
  }

  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  };
  cookies().set(ADVOGADO_SESSION_COOKIE, advogadoSessionToken(ADVOGADO_TOKEN_LOGIN), opts);
  cookies().set(ADVOGADO_ID_COOKIE, id, opts);
  return { ok: true };
}

/** GO-LIVE-04: cria a senha própria a partir do CONVITE assinado do escritório. */
export async function definirSenhaAdvogado(token: string, senha: string): Promise<LoginResult> {
  if (ADVOGADO_TOKEN_LOGIN === '')
    return {
      ok: false,
      error: 'servidor sem segredo de acesso configurado (ADVOGADO_ACCESS_SECRET)',
    };
  if (token.trim() === '' || senha === '')
    return { ok: false, error: 'convite e senha são obrigatórios' };
  try {
    const res = await fetch(`${API_BASE}/advogado-auth/definir-senha`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ADVOGADO_TOKEN_LOGIN}`,
      },
      body: JSON.stringify({ token: token.trim(), senha }),
    });
    if (!res.ok) {
      let detail = 'não foi possível concluir — peça um novo convite ao escritório';
      try {
        const parsed = (await res.json()) as { error?: string };
        if (typeof parsed.error === 'string' && parsed.error !== '') detail = parsed.error;
      } catch {
        /* corpo não-JSON */
      }
      return { ok: false, error: detail };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'API indisponível' };
  }
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

// ── 15C-2 · Solicitações Complementares — ações do advogado ────────────────────
import { revalidatePath } from 'next/cache';
import { advogadoId as advogadoIdAtual } from './api';
import type { Solicitacao } from './api';

export interface SolicitacaoActionResult {
  ok: boolean;
  error: string | null;
  solicitacao: Solicitacao | null;
}

export async function solicitarDocumento(input: {
  caseId: string;
  clientId: string;
  documentName: string;
  optionalMessage?: string;
  priority?: 'normal' | 'alta';
  dueAt?: string;
  reminderPolicy?: 'nenhum' | '24h' | '48h' | '72h' | 'semanal';
  /** Decreto Tráfego Pago · B1: documento para ASSINATURA (procuração/contrato
   *  de honorários) — a AHRI envia o arquivo anexado ao cliente. */
  anexo?: { fileName: string; mimeType: string; base64: string };
}): Promise<SolicitacaoActionResult> {
  const id = advogadoIdAtual();
  if (!id) return { ok: false, error: 'sessão do advogado ausente', solicitacao: null };
  const criada = await sendJson<Solicitacao & { anuncio?: { ok: boolean; erro: string | null } }>(
    'POST',
    `/advogado/casos/${encodeURIComponent(input.caseId)}/document-requests`,
    {
      documentName: input.documentName,
      optionalMessage: input.optionalMessage,
      clientId: input.clientId,
      advogadoId: id,
      requestedBy: id,
      priority: input.priority,
      dueAt: input.dueAt,
      reminderPolicy: input.reminderPolicy,
      ...(input.anexo !== undefined ? { anexo: input.anexo } : {}),
    },
  );
  revalidatePath('/solicitacoes');
  if (!criada)
    return { ok: false, error: 'não consegui criar a solicitação (API)', solicitacao: null };
  // Correção do teste real: falha de ENVIO ao cliente ficava invisível ("disse
  // enviado, não chegou"). Agora o advogado vê o erro literal do disparo.
  if (criada.anuncio && !criada.anuncio.ok) {
    return {
      ok: true,
      error: `Solicitação criada, mas o ENVIO ao cliente FALHOU: ${criada.anuncio.erro ?? 'erro desconhecido'}. Confira o WhatsApp do cliente e reenvie pela solicitação.`,
      solicitacao: criada,
    };
  }
  return { ok: true, error: null, solicitacao: criada };
}

// ── Decreto Tráfego Pago · B2 — o número de WhatsApp do advogado ───────────────
export async function meuCanalWhatsApp(): Promise<string | null> {
  const r = await sendJson<{ whatsapp: string | null }>('GET', '/advogado/perfil/canal', undefined);
  return r?.whatsapp ?? null;
}

export async function definirCanalWhatsApp(
  whatsapp: string,
): Promise<{ ok: boolean; error: string | null }> {
  const r = await sendJson<{ ok: boolean }>('PUT', '/advogado/perfil/canal', { whatsapp });
  revalidatePath('/perfil');
  return r
    ? { ok: true, error: null }
    : { ok: false, error: 'não consegui salvar o número (verifique DDI+DDD+número)' };
}

export async function cancelarSolicitacao(
  requestId: string,
  motivo: string,
): Promise<SolicitacaoActionResult> {
  const id = advogadoIdAtual();
  if (!id) return { ok: false, error: 'sessão do advogado ausente', solicitacao: null };
  const r = await sendJson<Solicitacao>(
    'POST',
    `/advogado/document-requests/${encodeURIComponent(requestId)}/cancelar`,
    { motivo, advogadoId: id },
  );
  revalidatePath('/solicitacoes');
  revalidatePath(`/solicitacoes/${requestId}`);
  return r
    ? { ok: true, error: null, solicitacao: r }
    : {
        ok: false,
        error: 'não consegui cancelar (a solicitação pode não estar aberta)',
        solicitacao: null,
      };
}

export async function reabrirSolicitacao(
  requestId: string,
  motivo: string,
): Promise<SolicitacaoActionResult> {
  const id = advogadoIdAtual();
  if (!id) return { ok: false, error: 'sessão do advogado ausente', solicitacao: null };
  const r = await sendJson<Solicitacao>(
    'POST',
    `/advogado/document-requests/${encodeURIComponent(requestId)}/reabrir`,
    { motivo, advogadoId: id },
  );
  revalidatePath('/solicitacoes');
  revalidatePath(`/solicitacoes/${requestId}`);
  return r
    ? { ok: true, error: null, solicitacao: r }
    : {
        ok: false,
        error: 'não consegui reabrir (só documentos recebidos podem ser reabertos)',
        solicitacao: null,
      };
}
