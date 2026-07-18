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

export async function fetchFounderBriefing(): Promise<FounderBriefing | null> {
  return getJson<FounderBriefing>('/admin/founder/briefing');
}

export async function askFounder(question: string): Promise<FounderAnswer | null> {
  return sendJson<FounderAnswer>('POST', '/admin/founder/ask', { question });
}

export async function fetchStaff(role: string): Promise<StaffData | null> {
  return getJson<StaffData>(`/admin/staff/${role}`);
}

export async function createStaff(role: string, name: string, email: string | null): Promise<StaffMember | null> {
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
  return sendJson('POST', `/admin/jornada/clientes/${encodeURIComponent(clienteId)}/modalidade`, { modalidade });
}

export async function venderCliente(
  clienteId: string,
  comprador: string,
): Promise<{ clienteId: string; vendido: boolean; comprador: string } | null> {
  return sendJson('POST', `/admin/jornada/clientes/${encodeURIComponent(clienteId)}/vender`, { comprador });
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
    const res = await fetch(`${API_BASE}/admin/jornada/pericia/${encodeURIComponent(clienteId)}/planilha`, {
      cache: 'no-store',
      headers: ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {},
    });
    if (!res.ok) return null;
    const conteudo = await res.text();
    const disposition = res.headers.get('content-disposition') ?? '';
    const nome = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `contratos-${clienteId}.csv`;
    return { clienteId, quem: '', nomeArquivo: nome, mime: res.headers.get('content-type') ?? 'text/csv', conteudo };
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
  return sendJson('POST', `/admin/jornada/pericia/${encodeURIComponent(clienteId)}/confirmar-pedidos`, {
    confirmadoPor: confirmadoPor ?? '',
  });
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

export async function encerrarMission(missionId: string, reason: string | null): Promise<CloseResult | null> {
  return sendJson<CloseResult>('POST', `/admin/missions/${missionId}/encerrar`, { reason: reason ?? '' });
}

// B4.3: reabertura OFICIAL de um processo encerrado (fato jurídico legítimo). Evento
// append-only; após reaberto, a AHRI volta a acompanhar automaticamente (recorrência B4.2).
export interface ReopenResult {
  missionId: string;
  reopened: boolean;
  skipped: boolean;
  stateId: string | null;
}

export async function reabrirMission(missionId: string, reason: string | null): Promise<ReopenResult | null> {
  return sendJson<ReopenResult>('POST', `/admin/missions/${missionId}/reabrir`, { reason: reason ?? '' });
}

// ── Conexão WhatsApp — administração de instância Evolution pelo Portal Admin ────
// Não-destrutivas (status/qr/confirm/apply) usam o Bearer do Admin. Destrutivas
// (criar/descartar) adicionam o header x-founder-secret com o FOUNDER_API_TOKEN
// SERVER-SIDE — o segredo Founder nunca chega ao browser.
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
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

async function founderPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
        ...(FOUNDER_TOKEN ? { 'x-founder-secret': FOUNDER_TOKEN } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
export async function createWhatsappInstance(instanceName: string): Promise<{ instanceName: string; qr: WhatsAppQr } | null> {
  return founderPost('/admin/whatsapp/instances', { instanceName });
}
export async function discardWhatsappInstance(instanceName: string): Promise<{ discarded: boolean } | null> {
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
