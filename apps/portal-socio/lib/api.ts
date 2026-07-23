// ─────────────────────────────────────────────────────────────────────────────
// API do Portal do SÓCIO — o portal É a camada de escopo: só as rotas do sócio
// são consumidas (login, definir-senha, painel do próprio CPF). O Bearer do Admin
// fica SERVER-SIDE (nunca vai ao browser); o sócio autentica com o segredo PRÓPRIO
// (cookie de sessão) e jamais vê este token.
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

// ── Tipos (espelham o PainelSocio servido pela API) ───────────────────────────
export interface FatiaRateio {
  rotulo: string;
  percentual: string;
  valor: number;
}

export interface PainelSocioView {
  cpf: string;
  nome: string;
  percentualBps: number;
  percentual: string;
  potencialTotal: number;
  meuValor: number;
  rateioReferencia: FatiaRateio[];
  clientes: number;
}

export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
