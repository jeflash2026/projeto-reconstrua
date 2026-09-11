// ─────────────────────────────────────────────────────────────────────────────
// Cliente da API do Portal do Advogado. Toda chamada leva a identificação do
// advogado (cookie 'advogado-id' → header x-advogado-id) — transporte provisório
// até a autenticação da Governança (DF-12). Só Read Models; falha vira estado
// explícito (null); nada é inventado.
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';

// Runtime (não NEXT_PUBLIC): NEXT_PUBLIC_* é inlinado no build do Next — no build
// Docker não existe e o fallback fica assado. Chamadas são server-side (BL-3.2).
export const API_BASE =
  process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3003';

// BL-3.1 (DF-12): o portal apresenta o segredo do Advogado (server-side, nunca ao
// browser). A identidade (x-advogado-id) segue atrás dessa autenticação real.
const ADVOGADO_TOKEN = process.env['ADVOGADO_API_TOKEN'] ?? '';

export function advogadoId(): string | null {
  const value = cookies().get('advogado-id')?.value ?? '';
  return value.trim() === '' ? null : value;
}

export async function getJson<T>(path: string, timeoutMs?: number): Promise<T | null> {
  const id = advogadoId();
  const headers: Record<string, string> = {};
  if (ADVOGADO_TOKEN) headers['authorization'] = `Bearer ${ADVOGADO_TOKEN}`;
  if (id) headers['x-advogado-id'] = id;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers,
      // Blindagem (caso Gracielle, 2026-08-05): uma leitura pesada na API não
      // pode deixar a página do advogado carregando para SEMPRE — expira e a
      // seção mostra "indisponível" em vez de nada abrir.
      ...(timeoutMs !== undefined ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function sendJson<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'GET',
  path: string,
  body?: unknown,
): Promise<T | null> {
  const id = advogadoId();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ADVOGADO_TOKEN) headers['authorization'] = `Bearer ${ADVOGADO_TOKEN}`;
  if (id) headers['x-advogado-id'] = id;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      ...(method === 'GET' || body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Tipos (espelham a API) ────────────────────────────────────────────────────
export interface PainelData {
  processCount: number;
  pendingCount: number;
  deadlinesSoon: number;
  protocolsWaiting: number;
  newDocuments: number;
  queue: number;
  alerts: string[];
}

export interface JuridicalEntry {
  id: string;
  advogadoId: string;
  missionId: string;
  kind: string;
  text: string;
  dueAt: string | null;
  attachmentRef: string | null;
  done: boolean;
  createdAt: string;
}

export interface ProcessRow {
  assignment: { missionId: string; advogadoId: string; assignedBy: string; assignedAt: string };
  summary: {
    missionId: string;
    chatId: string | null;
    createdAt: string;
    eventCount: number;
    lastEventAt: string;
    stateCount: number;
    stageCount: number;
  } | null;
}

export interface TimelineEntry {
  globalSeq: number;
  at: string;
  streamType: string;
  eventType: string;
  isRelevant: boolean;
  actor: string | null;
  operationalRuleRef: string | null;
  fundamento: string | null;
}

export interface ProcessDetail {
  missionId: string;
  timeline: TimelineEntry[];
  progress: { steps: string[] } | null;
  documents: Array<{
    documentId: string;
    contentReference: string | null;
    mimeType: string | null;
    recognizedAt: string;
  }>;
  pericias: Array<{ periciaId: string; framedAt: string }>;
  juridical: JuridicalEntry[];
}

/** PEDIDO ADMINISTRATIVO (2026-08-05): o relógio dos 10 dias — começa quando o
 *  perito baixa o pacote; resposta do banco ou prazo vencido encerram a espera. */
export interface PericiaDoCliente {
  iniciadaEm: string;
  prazoEm: string;
  diasRestantes: number;
  horasRestantes: number;
  expirado: boolean;
  respostaBanco?: { texto: string; registradaEm: string } | null;
}

/** MEUS CLIENTES (decreto 2026-07-29) — cliente destinado pelo Administrador. */
export interface MeuCliente {
  missionId: string;
  chatId: string | null;
  nome: string;
  atribuidoEm: string;
  documentos: number;
  /** null/ausente = o perito ainda não baixou o pacote (perícia não iniciada). */
  pericia?: PericiaDoCliente | null;
}

export interface Perfil {
  id: string;
  role: string;
  name: string;
  email: string | null;
  active: boolean;
  createdAt: string;
}

// ── 15C-2 · Solicitações Complementares de Documentos (Workflow 2) ─────────────
export type SolicitacaoStatus =
  'PENDING' | 'AWAITING_CONFIRMATION' | 'RECEIVED' | 'REOPENED' | 'CANCELLED';
export interface SolicitacaoHistorico {
  at: string;
  por: string;
  de: SolicitacaoStatus | null;
  para: SolicitacaoStatus;
  nota: string | null;
}
export interface Solicitacao {
  requestId: string;
  caseId: string;
  clientId: string;
  lawyerId: string;
  documentName: string;
  optionalMessage: string | null;
  origin: string;
  priority: 'normal' | 'alta';
  requestedBy: string;
  status: SolicitacaoStatus;
  receivedAt: string | null;
  fulfilledBy: string | null;
  dueAt: string | null;
  reminderPolicy: 'nenhum' | '24h' | '48h' | '72h' | 'semanal';
  lastReminderAt: string | null;
  lastMessagedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  history: SolicitacaoHistorico[];
}

// ── ACOMPANHAMENTO PROCESSUAL (2026-09-11) — processos judiciais dos clientes
//    entregues: cada intimação do DJEN com o parecer da AHRI e os alertas. ─────
export interface DeterminacaoDoJuizo {
  oQue: string;
  responsavel: string;
  prazoDias: number | null;
  diasCorridos: boolean;
}

export interface DeterminacaoComVencimento extends DeterminacaoDoJuizo {
  vencimentoEstimado: string | null;
  diasRestantes: number | null;
}

export interface AnaliseDaComunicacao {
  chave: string;
  processo: string;
  dataPublicacao: string;
  tipo: string;
  resumo: string;
  determinacoes: DeterminacaoDoJuizo[];
  exigeAcao: boolean;
  proximoPasso: string;
  tom: 'favoravel' | 'desfavoravel' | 'neutro';
  geradoEm: string;
}

export interface MovimentoAcompanhado {
  nome: string;
  dataHora: string;
  texto?: string;
  link?: string | null;
  fonte?: 'DATAJUD' | 'DJEN';
  chave: string | null;
  analise: AnaliseDaComunicacao | null;
  aguardandoParecer: boolean;
}

export interface ProcessoAcompanhado {
  numero: string;
  bancos: string[];
  tribunal: string;
  classe: string;
  orgaoJulgador: string;
  ultimoMovimento: { nome: string; dataHora: string } | null;
  consultadoEm: string | null;
  erro: string | null;
  movimentos: MovimentoAcompanhado[];
}

export interface ClienteAcompanhado {
  nome: string;
  chatId: string;
  juridicoClienteId: string | null;
  processos: ProcessoAcompanhado[];
  alertas: number;
}

export interface AlertaProcessual {
  chave: string;
  cliente: string;
  chatId: string;
  processo: string;
  dataPublicacao: string;
  tipo: string;
  resumo: string;
  proximoPasso: string;
  determinacoes: DeterminacaoComVencimento[];
  vencimentoEstimado: string | null;
  diasRestantes: number | null;
  vencido: boolean;
  ciente: boolean;
}

export interface Acompanhamento {
  hoje: string;
  alertas: AlertaProcessual[];
  clientes: ClienteAcompanhado[];
  aguardandoParecer: number;
  parecerDisponivel: boolean;
}
