// ─────────────────────────────────────────────────────────────────────────────
// API do Portal do INVESTIDOR — o portal É a camada de escopo: só as rotas do
// investidor são consumidas (login, definir-senha, painel do PRÓPRIO CPF). O
// Bearer do Admin fica SERVER-SIDE; o investidor jamais o vê.
// ─────────────────────────────────────────────────────────────────────────────
export const API_BASE = process.env['API_URL'] ?? 'http://localhost:3002';

const ADMIN_TOKEN = process.env['ADMIN_API_TOKEN'] ?? '';
export function authHeaders(): Record<string, string> {
  return ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {};
}

export async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers: authHeaders(),
      signal: AbortSignal.timeout(20_000),
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
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}

// ── Tipos (espelham o PainelInvestidor da API) ────────────────────────────────
export type FaseProcesso =
  'distribuido' | 'andamento' | 'sentenca' | 'execucao' | 'apurado' | 'pago' | 'perdido';

export interface ProcessoNoPainel {
  numero: string;
  iniciais: string;
  loteId: string;
  bancos: string[];
  advogado: string | null;
  tribunal: string;
  orgao: string;
  fase: FaseProcesso;
  faseRotulo: string;
  ultimaMovimentacao: { nome: string; data: string } | null;
  desde: string;
  mesesDecorridos: number;
  valor: {
    tipo: 'referencia' | 'apurado' | 'recebido' | 'sem-exito';
    parte: number;
    valorDoProcesso: number | null;
    em: string | null;
  };
  alocadoEm: string;
}

export interface LinhaExtrato {
  em: string;
  tipo: 'carteira' | 'apurado' | 'pago' | 'perdido' | 'correcao' | 'retirado';
  descricao: string;
  valor: number;
}

export interface PainelInvestidor {
  cpf: string;
  nome: string;
  geradoEm: string;
  totais: {
    processos: number;
    credito: number;
    limite: number;
    valorAtual: number;
    recebido: number;
    apurado: number;
    aReceber: number;
    emCurso: number;
    apurados: number;
    pagos: number;
    perdidos: number;
    valorDosProcessos: number;
  };
  carteiras: {
    id: string;
    criadoEm: string;
    credito: number;
    limite: number;
    processos: number;
    valorAtual: number;
    recebido: number;
    apurado: number;
    aReceber: number;
  }[];
  porFase: { fase: FaseProcesso; rotulo: string; processos: number; valor: number }[];
  processos: ProcessoNoPainel[];
  extrato: LinhaExtrato[];
  premissas: {
    valorReferenciaProcesso: number;
    parteDaEmpresa: number;
    referenciaPorProcesso: number;
    limiteSobreCredito: number;
    prazoEstimadoMeses: number;
  };
}

// ── Formatação ────────────────────────────────────────────────────────────────
export function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Moeda sem centavos quando o valor é redondo (R$ 125.000). */
export function moedaCurta(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: Number.isInteger(valor) ? 0 : 2,
  });
}

export function moedaComSinal(valor: number): string {
  if (valor === 0) return moedaCurta(0);
  return `${valor > 0 ? '+' : '−'}${moedaCurta(Math.abs(valor))}`;
}

/** 'AAAA-MM-DD' (ou ISO) → 'dd/mm/aaaa'. */
export function dataBr(valor: string | null): string {
  if (valor === null || valor.length < 10) return '—';
  return `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`;
}

/** Ramp ordinal dourado (validado: um tom, claro → escuro, contraste ≥ 2:1 no
 *  branco) — a fase mais madura é a mais escura; sem êxito fica neutro. */
export const COR_DA_FASE: Record<FaseProcesso, string> = {
  distribuido: '#caa233',
  andamento: '#b0850c',
  sentenca: '#8f6a09',
  execucao: '#6e5107',
  apurado: '#4f3a05',
  pago: '#302303',
  perdido: '#a39d93',
};
