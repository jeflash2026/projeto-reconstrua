// ─────────────────────────────────────────────────────────────────────────────
// API do PAINEL CNH — fala só com o serviço cnh-api (rede interna do Docker).
// O Bearer (CNH_API_TOKEN) fica SERVER-SIDE; o navegador nunca o vê.
// ─────────────────────────────────────────────────────────────────────────────
export const API_BASE = process.env['CNH_API_URL'] ?? 'http://localhost:3140';

const TOKEN = process.env['CNH_API_TOKEN'] ?? '';
export function authHeaders(): Record<string, string> {
  return TOKEN ? { authorization: `Bearer ${TOKEN}` } : {};
}

export async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers: authHeaders(),
      signal: AbortSignal.timeout(15_000),
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
      signal: AbortSignal.timeout(30_000),
    });
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}

// ── Tipos (espelham o AtendimentoCnh do serviço) ─────────────────────────────
export type EtapaCnh =
  | 'recepcao'
  | 'qualificacao'
  | 'viabilidade'
  | 'proposta'
  | 'morno'
  | 'aceito'
  | 'transferido'
  | 'descartado';

export const ETAPAS: readonly EtapaCnh[] = [
  'recepcao',
  'qualificacao',
  'viabilidade',
  'proposta',
  'morno',
  'aceito',
  'transferido',
  'descartado',
];

export const ROTULO_ETAPA: Readonly<Record<EtapaCnh, string>> = {
  recepcao: 'Recepção',
  qualificacao: 'Em qualificação',
  viabilidade: 'Explicação de viabilidade',
  proposta: 'Proposta enviada',
  morno: 'Lead morno',
  aceito: 'Coleta de dados',
  transferido: 'Com o advogado',
  descartado: 'Descarte',
};

export const ROTULO_SITUACAO: Readonly<Record<string, string>> = {
  'aviso-suspensao': 'Carta do DETRAN avisando suspensão',
  suspensa: 'CNH já suspensa ou cumprindo suspensão',
  cassacao: 'Notificação ou decisão de cassação',
  'indicacao-condutor': 'Indicou condutor e os pontos vieram para ele',
  outra: 'Outra situação (PPD, bloqueio de prontuário)',
};

export const MOTIVOS_DESCARTE: readonly { valor: string; rotulo: string }[] = [
  { valor: 'ja-tem-advogado', rotulo: 'Já tem advogado' },
  { valor: 'multa-simples', rotulo: 'Recurso de multa simples' },
  { valor: 'criminal', rotulo: 'Matéria criminal' },
  { valor: 'cassacao-cumprida', rotulo: 'Cassação cumprida há mais de 2 anos' },
  { valor: 'decisao-antiga-cumprida', rotulo: 'Decisão antiga, já cumprida' },
  { valor: 'indicacao-fora-do-prazo', rotulo: 'Indicação de condutor fora do prazo' },
  { valor: 'sem-condicao', rotulo: 'Sem condição de pagar' },
  { valor: 'outro', rotulo: 'Outro motivo' },
];

export const HONORARIOS: Readonly<Record<'suspensao' | 'cassacao', number>> = {
  suspensao: 1_500,
  cassacao: 2_000,
};

export interface FichaCnh {
  nome: string | null;
  cidade: string | null;
  jaTemAdvogado: boolean | null;
  situacao: string | null;
  relato: string | null;
  cartaDetran: 'recente' | 'antiga' | 'nao-recebeu' | null;
  cartaDetranQuando: string | null;
  prescricaoPossivel: boolean | null;
  motoristaProfissional: boolean | null;
  atividade: string | null;
  notificacoesAnteriores: 'nenhuma-ou-poucas' | 'todas' | 'nao-lembra' | null;
  indicacaoNoPrazo: boolean | null;
  temDocumentos: boolean | null;
  tipoCaso: 'suspensao' | 'cassacao' | null;
}

export interface MensagemCnh {
  id: string;
  de: 'cliente' | 'ahri' | 'equipe';
  texto: string;
  tipo: 'texto' | 'audio' | 'imagem' | 'documento' | 'outro';
  mediaId: string | null;
  nomeArquivo: string | null;
  em: string;
  autor: string | null;
  falha: string | null;
}

export interface LeadCnh {
  id: string;
  chatId: string;
  etapa: EtapaCnh;
  modo: 'ahri' | 'humano';
  ficha: FichaCnh;
  resumo: string | null;
  urgente: boolean;
  motivoDescarte: string | null;
  propostaEnviadaEm: string | null;
  aceitoEm: string | null;
  transferidoEm: string | null;
  descartadoEm: string | null;
  followup: { devidoEm: string; enviadoEm: string | null; por: string | null } | null;
  contratoEnviadoEm: string | null;
  pagamentoConfirmadoEm: string | null;
  atencao: string | null;
  ultimaDoClienteEm: string | null;
  conversa: MensagemCnh[];
  historico: { em: string; texto: string; autor: string }[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface LeadResumoCnh {
  id: string;
  nome: string | null;
  cidade: string | null;
  etapa: EtapaCnh;
  etapaRotulo: string;
  modo: 'ahri' | 'humano';
  resumo: string | null;
  urgente: boolean;
  motoristaProfissional: boolean | null;
  tipoCaso: 'suspensao' | 'cassacao' | null;
  atencao: string | null;
  ultimaMensagem: { de: MensagemCnh['de']; texto: string; em: string } | null;
  followupDevidoEm: string | null;
  atualizadoEm: string;
  criadoEm: string;
}

export interface ResumoCnh {
  total: number;
  porEtapa: Record<EtapaCnh, number>;
  novosHoje: number;
  aceitosHoje: number;
  precisamDeAtencao: number;
  followupsDevidos: number;
  urgentes: number;
}

export interface ConfigCnh {
  whatsapp: boolean;
  ia: boolean;
  modeloFollowup: string | null;
}

// ── Formatação ───────────────────────────────────────────────────────────────
const dois = (n: number): string => String(n).padStart(2, '0');

/** Data e hora em Brasília (UTC-3 fixo): o servidor roda em UTC. */
export function horaBr(iso: string | null): string {
  if (iso === null) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const d = new Date(t - 3 * 3_600_000);
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)} ${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
}

/** "há 5 min", "há 3 h", "há 2 dias". */
export function haQuanto(iso: string | null, agora = Date.now()): string {
  if (iso === null) return '—';
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${String(min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${String(h)} h`;
  const d = Math.round(h / 24);
  return `há ${String(d)} dia${d > 1 ? 's' : ''}`;
}

export function telefoneBr(id: string): string {
  const d = id.replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return d;
}

export const reais = (v: number): string =>
  v
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
    .replace(/\s/g, ' ');
