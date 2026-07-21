'use server';
// Server Actions (BL-2.2): as leituras e escritas dos COMPONENTES CLIENTE do Portal
// rodam no SERVIDOR do Next — onde o token do Admin (ADMIN_API_TOKEN) e a rede da API
// interna (porta 3002) existem. O browser nunca fala direto com a API nem vê o segredo.
// Reutiliza o cliente `lib/api` (BL-2.1) sem alterar a autenticação.
import {
  getJson,
  sendJson,
  type FounderAnswer,
  type FounderBriefing,
  type JornadaCliente,
  type StaffData,
  type StaffMember,
} from './api';

// ── AUTENTICAÇÃO (visitante → login → painel; nunca painel direto) ────────────
// Login = prova do segredo de acesso (BL-2.1, o MESMO segredo que o portal usa
// na API — nenhum segredo novo). Sessão = cookie httpOnly com HMAC do segredo.
// Bootstrap SEGURO do 1º administrador: só com o segredo válido e só enquanto o
// diretório de administradores estiver vazio (staff existente — nada novo).
import { cookies, headers } from 'next/headers';
import { adminSessionToken, secretsMatch, ADMIN_SESSION_COOKIE } from './session';

export interface LoginResult {
  ok: boolean;
  needsBootstrap?: boolean;
  error?: string;
}

const ADMIN_TOKEN_LOGIN = process.env['ADMIN_API_TOKEN'] ?? '';

function setAdminSession(): void {
  cookies().set(ADMIN_SESSION_COOKIE, adminSessionToken(ADMIN_TOKEN_LOGIN), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12, // 12h de expediente
  });
}

export async function loginAdmin(senha: string): Promise<LoginResult> {
  if (ADMIN_TOKEN_LOGIN === '')
    return { ok: false, error: 'servidor sem segredo de acesso configurado (ADMIN_ACCESS_SECRET)' };
  if (!secretsMatch(senha.trim(), ADMIN_TOKEN_LOGIN))
    return { ok: false, error: 'senha de acesso incorreta' };
  setAdminSession();
  // GO-LIVE-05: a verdade do bootstrap é do SERVIDOR (∃ administrador ativo),
  // NUNCA inferida contando a lista (causa raiz do bug: leitura vazia/falha
  // reabria o bootstrap). Fail-closed: se a consulta falhar, NÃO oferece
  // bootstrap (uma tela de login a mais é seguro; recriar admin não é).
  const state = await getJson<{ bootstrapped: boolean }>('/admin/bootstrap');
  const needsBootstrap = state !== null && state.bootstrapped === false;
  return { ok: true, needsBootstrap };
}

export async function bootstrapAdmin(senha: string, nome: string): Promise<LoginResult> {
  if (!secretsMatch(senha.trim(), ADMIN_TOKEN_LOGIN))
    return { ok: false, error: 'senha de acesso incorreta' };
  // GO-LIVE-05: bootstrap ONE-TIME no servidor. 409 = já inicializado (corrida ou
  // duplo clique) ⇒ tratamos como sucesso e apenas abrimos a sessão.
  const res = await fetch(`${API_BASE}/admin/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN_LOGIN}` },
    body: JSON.stringify({ name: nome.trim() }),
    cache: 'no-store',
  }).catch(() => null);
  if (res === null) return { ok: false, error: 'API indisponível — tente novamente' };
  if (!res.ok && res.status !== 409) {
    return { ok: false, error: 'falha ao inicializar o administrador — tente novamente' };
  }
  setAdminSession();
  return { ok: true };
}

export async function logoutAdmin(): Promise<void> {
  cookies().delete(ADMIN_SESSION_COOKIE);
  return Promise.resolve(); // server action: assinatura async exigida
}

export async function fetchFounderBriefing(): Promise<FounderBriefing | null> {
  return getJson<FounderBriefing>('/admin/founder/briefing');
}

export async function askFounder(question: string): Promise<FounderAnswer | null> {
  return sendJson<FounderAnswer>('POST', '/admin/founder/ask', { question });
}

export async function fetchStaff(role: string): Promise<StaffData | null> {
  return getJson<StaffData>(`/admin/staff/${role}`);
}

export async function createStaff(
  role: string,
  name: string,
  email: string | null,
): Promise<StaffMember | null> {
  return sendJson<StaffMember>('POST', '/admin/staff', { role, name, email });
}

export async function setStaffActive(id: string, active: boolean): Promise<StaffMember | null> {
  return sendJson<StaffMember>('PATCH', `/admin/staff/${id}`, { active });
}

// ── JORNADA A (R4) — lista única + os DOIS atos do Admin (Regra 3: comandos
// canônicos da API; nenhum caminho paralelo de escrita). Server-side, autenticado.
export async function fetchJornadaClientes(): Promise<{ clientes: JornadaCliente[] } | null> {
  return getJson<{ clientes: JornadaCliente[] }>('/admin/jornada/clientes');
}

export async function definirModalidade(
  clienteId: string,
  modalidade: 'VENDA' | 'SOCIEDADE',
): Promise<{ clienteId: string; modalidade: string } | null> {
  return sendJson('POST', `/admin/jornada/clientes/${encodeURIComponent(clienteId)}/modalidade`, {
    modalidade,
  });
}

export async function venderCliente(
  clienteId: string,
  comprador: string,
): Promise<{ clienteId: string; vendido: boolean; comprador: string } | null> {
  return sendJson('POST', `/admin/jornada/clientes/${encodeURIComponent(clienteId)}/vender`, {
    comprador,
  });
}

// ── JORNADA B (B-R6) — operação do PERITO: fila derivada, planilhas (CSV) e o
// ato "confirmar pedidos administrativos" (o único fato persistido de B). Regra 3:
// comandos canônicos da API; downloads via conteúdo retornado (token só no server).
export interface PlanilhaGerada {
  clienteId: string;
  quem: string;
  nomeArquivo: string;
  mime: string;
  conteudo: string;
}

export async function fetchFilaPericia(): Promise<{ clientes: JornadaCliente[] } | null> {
  return getJson<{ clientes: JornadaCliente[] }>('/admin/jornada/clientes?fila=pericia');
}

export async function fetchPlanilhaCliente(clienteId: string): Promise<PlanilhaGerada | null> {
  try {
    const res = await fetch(
      `${API_BASE}/admin/jornada/pericia/${encodeURIComponent(clienteId)}/planilha`,
      {
        cache: 'no-store',
        headers: ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {},
      },
    );
    if (!res.ok) return null;
    const conteudo = await res.text();
    const disposition = res.headers.get('content-disposition') ?? '';
    const nome = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `contratos-${clienteId}.csv`;
    return {
      clienteId,
      quem: '',
      nomeArquivo: nome,
      mime: res.headers.get('content-type') ?? 'text/csv',
      conteudo,
    };
  } catch {
    return null;
  }
}

export async function fetchPlanilhasLote(): Promise<{ planilhas: PlanilhaGerada[] } | null> {
  return getJson<{ planilhas: PlanilhaGerada[] }>('/admin/jornada/pericia/planilhas');
}

export async function confirmarPedidos(
  clienteId: string,
  confirmadoPor: string | null,
): Promise<{ clienteId: string; confirmado: boolean; prazoAte: string } | null> {
  return sendJson(
    'POST',
    `/admin/jornada/pericia/${encodeURIComponent(clienteId)}/confirmar-pedidos`,
    {
      confirmadoPor: confirmadoPor ?? '',
    },
  );
}

// B4.1: encerramento OFICIAL do processo — ato humano do operador. Chama a API do
// Admin (server-side, autenticada). A partir do encerramento, a AHRI PARA e nenhum
// acompanhamento recorrente é enviado. Reutiliza o mesmo cliente/segredo do portal.
export interface CloseResult {
  missionId: string;
  closed: boolean;
  skipped: boolean;
  stateId: string | null;
}

export async function encerrarMission(
  missionId: string,
  reason: string | null,
): Promise<CloseResult | null> {
  return sendJson<CloseResult>('POST', `/admin/missions/${missionId}/encerrar`, {
    reason: reason ?? '',
  });
}

// B4.3: reabertura OFICIAL de um processo encerrado (fato jurídico legítimo). Evento
// append-only; após reaberto, a AHRI volta a acompanhar automaticamente (recorrência B4.2).
export interface ReopenResult {
  missionId: string;
  reopened: boolean;
  skipped: boolean;
  stateId: string | null;
}

export async function reabrirMission(
  missionId: string,
  reason: string | null,
): Promise<ReopenResult | null> {
  return sendJson<ReopenResult>('POST', `/admin/missions/${missionId}/reabrir`, {
    reason: reason ?? '',
  });
}

// ── Conexão WhatsApp — administração de instância Evolution pelo Portal Admin ────
// Não-destrutivas (status/qr/confirm/apply) usam o Bearer do Admin. Destrutivas
// (criar/descartar) adicionam o header x-founder-secret com o FOUNDER_API_TOKEN
// SERVER-SIDE — o segredo Founder nunca chega ao browser.
const API_BASE =
  process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const ADMIN_TOKEN = process.env['ADMIN_API_TOKEN'] ?? '';
const FOUNDER_TOKEN = process.env['FOUNDER_API_TOKEN'] ?? '';

export interface WhatsAppQr {
  base64: string | null;
  pairingCode: string | null;
}
export interface WhatsAppStatus {
  active: { instance: string; number: string };
  pending: { instance: string; number: string } | null;
  hasPendingApply: boolean;
  live: { state: string; ownerJid: string | null; number: string } | null;
  matchesOfficial: boolean;
  officialNumber: string;
  webhookUrl: string;
  lastSyncAt: string | null;
  capabilities: { canManageInstances: boolean; missing: string[] };
  resolvedInstance: string | null;
}
export interface WhatsAppConfirm {
  connected: boolean;
  ownerJid: string | null;
  number: string;
  matchesOfficial: boolean;
  error: string | null;
}
export interface ApplyInstructions {
  pending: boolean;
  envToSet?: { EVOLUTION_INSTANCE: string; WHATSAPP_NUMBER: string };
  note?: string;
  command?: string;
}

export async function fetchWhatsappStatus(): Promise<WhatsAppStatus | null> {
  return getJson<WhatsAppStatus>('/admin/whatsapp/status');
}
export async function fetchWhatsappQr(instance: string): Promise<WhatsAppQr | null> {
  return getJson<WhatsAppQr>(`/admin/whatsapp/qr/${encodeURIComponent(instance)}`);
}
export async function confirmWhatsapp(instanceName: string): Promise<WhatsAppConfirm | null> {
  return sendJson<WhatsAppConfirm>('POST', '/admin/whatsapp/confirm', { instanceName });
}
export async function fetchApplyInstructions(): Promise<ApplyInstructions | null> {
  return getJson<ApplyInstructions>('/admin/whatsapp/apply-instructions');
}

// GO-LIVE-05 (BUG 2): DIAGNÓSTICO — o erro REAL de cada dependência. Diferente do
// getJson genérico: quando a própria API falha, devolve a causa (HTTP/rede), não null.
export interface DiagnosticStep {
  step: string;
  ok: boolean;
  detail: string;
}
export interface DiagnosticReport {
  ok: boolean;
  steps: DiagnosticStep[];
  at: string;
}

export async function runWhatsappDiagnostics(): Promise<{
  report: DiagnosticReport | null;
  error: string | null;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/whatsapp/diagnostics`, {
      cache: 'no-store',
      headers: ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {},
    });
    if (!res.ok) {
      let detail = `A API administrativa respondeu HTTP ${String(res.status)}`;
      if (res.status === 401)
        detail = 'A API recusou a autenticação (ADMIN_ACCESS_SECRET incorreto no servidor)';
      if (res.status === 503)
        detail =
          'A conexão WhatsApp não está montada na API (verifique a configuração da Evolution)';
      return { report: null, error: detail };
    }
    return { report: (await res.json()) as DiagnosticReport, error: null };
  } catch (error) {
    return {
      report: null,
      error:
        error instanceof Error
          ? `API administrativa inacessível: ${error.message}`
          : 'API administrativa inacessível',
    };
  }
}

// GO-LIVE-03 (item 6): o erro REAL da API atravessa até a tela — nunca um null
// mudo. Se o servidor do portal não tem o segredo Founder, a causa é declarada.
export interface FounderActionResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

async function founderPost<T>(path: string, body: unknown): Promise<FounderActionResult<T>> {
  if (FOUNDER_TOKEN === '') {
    return {
      ok: false,
      data: null,
      error:
        'FOUNDER_ACCESS_SECRET não configurado no servidor — defina no .env e recrie os containers.',
    };
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
        'x-founder-secret': FOUNDER_TOKEN,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) {
      let detail = `HTTP ${String(res.status)}`;
      try {
        const parsed = (await res.json()) as { error?: string };
        if (typeof parsed.error === 'string' && parsed.error !== '') detail = parsed.error;
      } catch {
        /* corpo não-JSON: mantém o status */
      }
      return { ok: false, data: null, error: detail };
    }
    return { ok: true, data: (await res.json()) as T, error: null };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: error instanceof Error ? `API inacessível: ${error.message}` : 'API inacessível',
    };
  }
}
export async function createWhatsappInstance(
  instanceName: string,
): Promise<FounderActionResult<{ instanceName: string; qr: WhatsAppQr }>> {
  return founderPost('/admin/whatsapp/instances', { instanceName });
}
export async function discardWhatsappInstance(
  instanceName: string,
): Promise<FounderActionResult<{ discarded: boolean }>> {
  return founderPost('/admin/whatsapp/discard', { instanceName, confirm: true });
}

// BL-3.4: a atribuição de caso NASCE no Portal Admin e chama a API EXISTENTE do
// servidor Advogado (/advogado-admin/assignments), autenticada pelo segredo do
// Advogado (BL-3.1). Server-side; o browser nunca vê o segredo. Sem fluxo paralelo,
// sem nova persistência/workflow — a mesma `op.work.assign` já existente.
const ADVOGADO_API_URL = process.env['ADVOGADO_API_URL'] ?? '';
const ADVOGADO_API_TOKEN = process.env['ADVOGADO_API_TOKEN'] ?? '';

export interface AssignmentResult {
  missionId: string;
  advogadoId: string;
  assignedBy: string;
  assignedAt: string;
  /** Decreto Tráfego Pago: resultado do AVISO da AHRI ao advogado (canal dele). */
  aviso?: 'enviado' | 'sem-canal' | 'falhou';
}

// ── Decreto Tráfego Pago — CLIENTES PRONTOS P/ ADVOGADO ───────────────────────
export interface ClientePronto {
  clienteId: string;
  chatId: string;
  missionId: string;
  nome: string;
  status: string;
  pedidosConfirmadosEm: string | null;
}

export async function listarClientesProntos(): Promise<{
  prontos: ClientePronto[];
  advogados: { id: string; name: string }[];
} | null> {
  if (ADVOGADO_API_URL === '') return null;
  try {
    const res = await fetch(`${ADVOGADO_API_URL}/advogado-admin/clientes-prontos`, {
      headers: { ...(ADVOGADO_API_TOKEN ? { authorization: `Bearer ${ADVOGADO_API_TOKEN}` } : {}) },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      prontos: ClientePronto[];
      advogados: { id: string; name: string }[];
    };
  } catch {
    return null;
  }
}

// ── GO-LIVE-04: CONVITE do advogado — o link de criação de senha nasce do ATO
// do Administrador (nunca cadastro público, nunca criação pela URL). O token é
// assinado pelo Auth Runtime na API do Advogado; aqui só transporte + montagem
// do link no domínio único da plataforma.
export async function gerarConviteAdvogado(
  advogadoId: string,
): Promise<{ link: string | null; error: string | null }> {
  if (ADVOGADO_API_URL === '')
    return {
      link: null,
      error: 'integração com o Portal do Advogado não configurada (ADVOGADO_API_URL)',
    };
  try {
    const res = await fetch(`${ADVOGADO_API_URL}/advogado-admin/convite`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ADVOGADO_API_TOKEN ? { authorization: `Bearer ${ADVOGADO_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ advogadoId }),
      cache: 'no-store',
    });
    if (!res.ok) {
      let detail = `HTTP ${String(res.status)}`;
      try {
        const parsed = (await res.json()) as { error?: string };
        if (typeof parsed.error === 'string' && parsed.error !== '') detail = parsed.error;
      } catch {
        /* corpo não-JSON */
      }
      return { link: null, error: detail };
    }
    const data = (await res.json()) as { token: string };
    const h = headers();
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
    if (host === '')
      return { link: null, error: 'não foi possível determinar o domínio da plataforma' };
    return { link: `${proto}://${host}/advogado/convite?t=${data.token}`, error: null };
  } catch {
    return { link: null, error: 'API do Portal do Advogado inacessível' };
  }
}

/** Decreto 2026-07-21: convite do PERITO (link de criação de senha própria) —
 *  emitido pela API do Admin; o link aponta ao Portal do Perito (/perito). */
export async function gerarConvitePerito(
  peritoId: string,
): Promise<{ link: string | null; error: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/admin/perito/convite`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
      },
      body: JSON.stringify({ peritoId }),
      cache: 'no-store',
    });
    if (!res.ok) {
      let detail = `HTTP ${String(res.status)}`;
      try {
        const parsed = (await res.json()) as { error?: string };
        if (typeof parsed.error === 'string' && parsed.error !== '') detail = parsed.error;
      } catch {
        /* corpo não-JSON */
      }
      return { link: null, error: detail };
    }
    const data = (await res.json()) as { token: string };
    const h = headers();
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
    if (host === '')
      return { link: null, error: 'não foi possível determinar o domínio da plataforma' };
    return { link: `${proto}://${host}/perito/convite?t=${data.token}`, error: null };
  } catch {
    return { link: null, error: 'API do Admin inacessível' };
  }
}

export async function assignCase(
  missionId: string,
  advogadoId: string,
  assignedBy: string,
): Promise<AssignmentResult | null> {
  if (ADVOGADO_API_URL === '') return null;
  try {
    const res = await fetch(`${ADVOGADO_API_URL}/advogado-admin/assignments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ADVOGADO_API_TOKEN ? { authorization: `Bearer ${ADVOGADO_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ missionId, advogadoId, assignedBy }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as AssignmentResult;
  } catch {
    return null;
  }
}
