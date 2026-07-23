// ─────────────────────────────────────────────────────────────────────────────
// API do Portal do PERITO — o portal É a camada de escopo: só as rotas da
// função pericial são consumidas (fila, contratos, planilha, confirmação).
// O Bearer do Admin fica SERVER-SIDE (nunca vai ao browser); o perito autentica
// com o segredo PRÓPRIO (cookie de sessão) e jamais vê este token.
// ─────────────────────────────────────────────────────────────────────────────
export const API_BASE = process.env['API_URL'] ?? 'http://localhost:3002';

const ADMIN_TOKEN = process.env['ADMIN_API_TOKEN'] ?? '';
export function authHeaders(): Record<string, string> {
  return ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {};
}

export async function getJson<T>(path: string, timeoutMs?: number): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers: authHeaders(),
      // Blindagem: uma varredura pesada (ex.: "todos com HISCON" em cache frio)
      // NUNCA pode travar a renderização da página — expira e devolve null.
      ...(timeoutMs !== undefined ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
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

// ── Tipos (espelham os read models já servidos pela API) ──────────────────────
export interface ClienteDaFila {
  clienteId: string;
  chatId: string;
  quem: string;
  status: string;
  ultimoContatoAt: string | null;
  pedidosConfirmadosEm: string | null;
}

/** TODOS os clientes com HISCON legível (Decreto 2026-07-23). */
export interface ClienteComHiscon {
  clienteId: string;
  chatId: string;
  quem: string;
  totalContratos: number;
  status: string;
  ultimoContatoAt: string | null;
}
