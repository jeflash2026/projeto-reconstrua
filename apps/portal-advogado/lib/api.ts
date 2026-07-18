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

export async function getJson<T>(path: string): Promise<T | null> {
  const id = advogadoId();
  const headers: Record<string, string> = {};
  if (ADVOGADO_TOKEN) headers['authorization'] = `Bearer ${ADVOGADO_TOKEN}`;
  if (id) headers['x-advogado-id'] = id;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function sendJson<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T | null> {
  const id = advogadoId();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ADVOGADO_TOKEN) headers['authorization'] = `Bearer ${ADVOGADO_TOKEN}`;
  if (id) headers['x-advogado-id'] = id;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: JSON.stringify(body),
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
  documents: Array<{ documentId: string; contentReference: string | null; mimeType: string | null; recognizedAt: string }>;
  pericias: Array<{ periciaId: string; framedAt: string }>;
  juridical: JuridicalEntry[];
}

export interface Perfil {
  id: string;
  role: string;
  name: string;
  email: string | null;
  active: boolean;
  createdAt: string;
}
