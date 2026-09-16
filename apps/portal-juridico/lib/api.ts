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

/** Acompanhamento automático (DataJud + DJEN, CNJ) de um processo. */
export interface AndamentoProcesso {
  numero: string;
  tribunal: string;
  classe: string;
  orgaoJulgador: string;
  assunto: string;
  grau: string;
  dataAjuizamento: string;
  ultimoMovimento: { nome: string; dataHora: string } | null;
  /** Publicação do DJEN traz o texto do despacho e o link do eproc. */
  movimentos: {
    nome: string;
    dataHora: string;
    texto?: string;
    link?: string | null;
    fonte?: 'DATAJUD' | 'DJEN';
  }[];
  emExecucao: boolean;
  novidade: boolean;
  consultadoEm: string;
  erro: string | null;
}

export interface DashboardJuridico {
  clientes: number;
  contratos: number;
  ativos: number;
  encerrados: number;
  excluidos: number;
  valorAtivos: number;
  guias: { total: number; valor: number };
  periciasProximas: PericiaJuridica[];
  alertas: {
    tipo: string;
    clienteNome: string;
    processo: string;
    movimento: string;
    dataHora: string;
    novidade: boolean;
  }[];
  movimentacoesPendentes: number;
  ultimaConsultaDatajud: string | null;
  recentes: (ContratoJuridico & { clienteNome: string })[];
  porBanco: { banco: string; total: number }[];
  historico: { texto: string; detalhe: string; autor: string; em: string }[];
  /** 2026-09-10: processos (nº CNJ) cujo 1º contrato foi cadastrado hoje (Brasília).
   *  Opcional: API anterior ao deploy não manda — o card mostra 0. */
  distribuidosHoje?: {
    dia: string;
    processos: number;
    clientes: number;
    itens: { processo: string; banco: string; clienteNome: string; em: string }[];
  };
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

/** PASTAS POR ADVOGADO (2026-09-10) — entregas do Admin × cadastro do jurídico. */
export interface PastasJuridico {
  pastas: {
    advogadoId: string;
    advogado: string;
    entregues: number;
    comProcesso: number;
    aguardando: number;
    clientes: {
      nome: string;
      chatId: string;
      entregueEm: string | null;
      juridicoClienteId: string | null;
      processos: number;
    }[];
  }[];
  semAdvogado: { clienteId: string; nome: string; processos: number }[];
}

// ── ACOMPANHAMENTO PROCESSUAL (2026-09-11) — parecer da AHRI por intimação ────
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

export type MovimentoDoProcesso = AndamentoProcesso['movimentos'][number];

export interface MovimentoComParecer extends MovimentoDoProcesso {
  chave: string | null;
  analise: AnaliseDaComunicacao | null;
  aguardandoParecer: boolean;
}

export interface AcompanhamentoDoProcesso {
  hoje: string;
  movimentos: MovimentoComParecer[];
  atual: { analise: AnaliseDaComunicacao; determinacoes: DeterminacaoComVencimento[] } | null;
  atualPendente: boolean;
  aguardandoParecer: number;
  parecerDisponivel: boolean;
}

/** RESULTADO DO PROCESSO (2026-09-16): pago/perdido lançado pelo escritório. */
export interface ResultadoProcessoView {
  situacao: 'em-andamento' | 'pago' | 'perdido';
  valorRecebido: number | null;
  data: string | null;
  observacao: string;
  autor: string;
  em: string;
}

/** A ficha de UM processo (GET /admin/juridico/processos/:numero). */
export interface ProcessoDetalhe {
  numero: string;
  clienteId: string;
  clienteNome: string;
  contratos: ContratoJuridico[];
  andamento: AndamentoProcesso | null;
  /** null = parecer automático fora desta montagem. */
  acompanhamento: AcompanhamentoDoProcesso | null;
  /** 2026-09-16: desfecho lançado (ausente em API anterior ao deploy). */
  resultado?: ResultadoProcessoView | null;
  /** De quem é o processo na carteira de investidores (null = de ninguém). */
  investidor?: { nome: string } | null;
}

/** URL da ficha do processo — só dígitos (o ponto do CNJ não entra na rota). */
export function urlDoProcesso(numero: string): string {
  return `/juridico/processos/${numero.replace(/\D/g, '')}`;
}
