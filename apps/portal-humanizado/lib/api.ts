// ─────────────────────────────────────────────────────────────────────────────
// API do Portal do ATENDIMENTO HUMANIZADO — o portal É a camada de escopo: só a
// mesa da secretária é consumida (clientes confirmados + docs da fase 2). O
// Bearer do Admin fica SERVER-SIDE (nunca vai ao browser).
// ─────────────────────────────────────────────────────────────────────────────
export const API_BASE = process.env['API_URL'] ?? 'http://localhost:3002';

const ADMIN_TOKEN = process.env['ADMIN_API_TOKEN'] ?? '';
export function authHeaders(): Record<string, string> {
  return ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {};
}

export async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Tipos (espelham a mesa servida pela API) ──────────────────────────────────
export interface ClienteHumanizado {
  clienteId: string;
  chatId: string;
  nome: string;
  telefone: string;
  uf: string;
  confirmadoEm: string;
  /** O TAMANHO do caso: contratos e indícios do parecer + potencial (R$). */
  contratos: number;
  indicios: number;
  potencial: number;
  docs: { procuracao: boolean; rg: boolean; comprovante: boolean };
  completo: boolean;
  aguardandoAssinatura: boolean;
}

export interface DocEquipe {
  id: string;
  tipo: string;
  rotulo: string;
  nome: string;
  em: string;
}
