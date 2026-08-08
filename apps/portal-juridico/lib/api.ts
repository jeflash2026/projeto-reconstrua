// ─────────────────────────────────────────────────────────────────────────────
// API do PAINEL JURÍDICO — o Bearer do Admin fica SERVER-SIDE (nunca vai ao
// browser); o portal fala com /admin/juridico/* da API interna.
// ─────────────────────────────────────────────────────────────────────────────
export const API_BASE = process.env['API_URL'] ?? 'http://localhost:3002';

const ADMIN_TOKEN = process.env['ADMIN_API_TOKEN'] ?? '';
export function authHeaders(): Record<string, string> {
  return ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {};
}

export async function getJson<T>(path: string, timeoutMs = 20_000): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers: authHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Tipos (espelham o JuridicoService da API) ────────────────────────────────

export interface AnexoJuridico {
  id: string;
  nome: string;
  mime: string;
  size: number;
  em: string;
}

export interface ClienteJuridico {
  id: string;
  nome: string;
  nascimento: string;
  sexo: string;
  cpfCnpj: string;
  rg: string;
  orgaoEmissor: string;
  ufEmissao: string;
  email: string;
  telefone: string;
  celular1: string;
  celular2: string;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    complemento: string;
    cep: string;
    cidade: string;
    uf: string;
  };
  observacoes: string;
  anexos: AnexoJuridico[];
  criadoPor: string;
  em: string;
}

export interface ContratoJuridico {
  id: string;
  clienteId: string;
  clienteNome?: string;
  processoNumero: string;
  banco: string;
  numero: string;
  valor: number | null;
  assinatura: string | null;
  inicio: string | null;
  fimPrevisto: string | null;
  observacoes: string;
  status: 'ativo' | 'encerrado' | 'excluido';
  encerramento: { data: string; motivo: string } | null;
  exclusao: { motivo: string; em: string } | null;
  anexos: AnexoJuridico[];
  historico: { texto: string; autor: string; em: string }[];
  criadoPor: string;
  em: string;
  atualizadoEm: string;
}

export interface GuiaJuridica {
  id: string;
  processo: string;
  nome: string;
  advogado: string;
  valor: number | null;
  mes: string;
  andamento: string;
  criadoPor: string;
  em: string;
}

export interface PericiaJuridica {
  id: string;
  processo: string;
  assunto: string;
  requerente: string;
  requerido: string;
  data: string | null;
  horario: string | null;
  local: string;
  situacao: string;
  advogado: string;
  andamento: string;
  criadoPor: string;
  em: string;
}

export interface DashboardJuridico {
  clientes: number;
  contratos: number;
  ativos: number;
  encerrados: number;
  excluidos: number;
  recentes: (ContratoJuridico & { clienteNome: string })[];
  porBanco: { banco: string; total: number }[];
  historico: { texto: string; detalhe: string; autor: string; em: string }[];
}

export function moeda(valor: number | null): string {
  if (valor === null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dataBr(iso: string | null): string {
  if (iso === null || iso === '') return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
}

export const ROTULO_SITUACAO: Record<string, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  reagendado: 'Reagendado',
  'pedir-reagendamento': 'Pedir reagendamento',
  'nao-compareceu': 'Não compareceu',
  'audiencia-online': 'Audiência online',
  cancelada: 'Cancelada',
};

export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
