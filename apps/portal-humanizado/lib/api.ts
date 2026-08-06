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

export async function getJson<T>(path: string, timeoutMs?: number): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers: authHeaders(),
      // Blindagem: uma API ocupada NUNCA pode deixar a mesa carregando para
      // sempre — expira e a página mostra o aviso em vez de ficar em branco.
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
  docs: { procuracao: boolean; rg: boolean; comprovante: boolean; extratoCredito?: boolean };
  completo: boolean;
  aguardandoAssinatura: boolean;
  /** QUANDO a secretária marcou "enviei a documentação" (ISO) — null se não marcou. */
  aguardandoDesde: string | null;
  /** DESCARTE (2026-08-04): fora da fila até um SIM novo do cliente ou a
   *  reativação manual. Opcionais: a API do build anterior não os envia. */
  descartado?: boolean;
  descartadoEm?: string | null;
  /** ADVOGADO RESPONSÁVEL (guia v2): marcado ao enviar a procuração. */
  advogadoId?: string | null;
}

export interface AdvogadoOpcao {
  id: string;
  nome: string;
}

export interface DocEquipe {
  id: string;
  tipo: string;
  rotulo: string;
  nome: string;
  em: string;
}

/** Resumo de uma conversa do canal da equipe (caixa de entrada da mesa). */
export interface ResumoChat {
  chatId: string;
  total: number;
  ultimaEm: string | null;
  previa: string;
  naoLidas: number;
  /** Quem falou por último — 'entrada' = o cliente espera a equipe. */
  ultimaDirecao?: 'entrada' | 'saida' | null;
  /** Última mensagem DO CLIENTE (ISO) — mede o silêncio dele. */
  ultimaEntradaEm?: string | null;
}

/** CHAT DO CANAL DA EQUIPE (decreto 2026-08-05) — a conversa 100% humana do
 *  número (41) na Meta; a AHRI nunca responde nele. */
export interface MensagemChat {
  id: string;
  direcao: 'entrada' | 'saida';
  tipo: 'texto' | 'documento' | 'imagem' | 'audio' | 'template';
  texto: string | null;
  nomeArquivo: string | null;
  mime: string | null;
  sha256: string | null;
  autor: string | null;
  confirmadoComo: string | null;
  /** FALHA DE ENTREGA (2026-08-06): a Meta aceitou e falhou depois (ex.:
   *  janela de 24h) — o chat mostra o aviso em vermelho na mensagem. */
  falha?: string | null;
  em: string;
}
