// ─────────────────────────────────────────────────────────────────────────────
// Cliente da API do Portal — o ÚNICO caminho de dados. Consome exclusivamente os
// READ MODELS servidos pela API (`/admin/*`); jamais o Event Store. Sem cache
// (`no-store`): tempo real por leitura fresca. Falha de rede vira estado explícito
// (`null`) — a UI mostra "API indisponível", nunca dado inventado.
// ─────────────────────────────────────────────────────────────────────────────

// CAUSA RAIZ (integração): NEXT_PUBLIC_* é INLINADO no build do Next — no build
// Docker a variável não existe e o fallback localhost fica assado na imagem.
// Toda chamada é SERVER-SIDE (BL-2.2), então o nome correto é runtime: API_URL.
export const API_BASE =
  process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// BL-2.1 (DF-12): o portal apresenta o segredo do Admin (server-side, nunca ao browser).
const ADMIN_TOKEN = process.env['ADMIN_API_TOKEN'] ?? '';
function authHeaders(): Record<string, string> {
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

export async function sendJson<T>(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
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

// ── Tipos das respostas (espelham os read models da API) ──────────────────────
export interface DashboardData {
  activeClients: number;
  newClientsToday: number;
  awaitingDocuments: number;
  awaitingPericia: number;
  awaitingAdvogado: number;
  processesDistributed: number;
  avgHandlingMs: number | null;
  messageCount: number;
  documentCount: number;
  financialUnderAdministration: number | null;
  expectedFees: number | null;
  bottlenecks: string;
  alerts: string;
  health: ComponentHealth[];
  overall: string;
}

// ── AHRI COMMAND CENTER (13A) — briefing dinâmico + indicadores (Read Models) ──
export type CCSeveridade = 'critico' | 'alerta' | 'oportunidade' | 'informacao';
export interface CCInsight {
  id: string;
  categoria: string;
  severidade: CCSeveridade;
  titulo: string;
  detalhe: string | null;
  fonte: string;
  href: string | null;
  valor: number | null;
}
export interface CCIndicador {
  id: string;
  rotulo: string;
  valor: string;
  tom: 'neutro' | 'positivo' | 'atencao' | 'critico';
  fonte: string;
  href: string | null;
}
export interface CommandCenterData {
  briefing: {
    saudacao: string;
    resumo: string;
    insights: CCInsight[];
    totalInsights: number;
    geradoEm: string;
    fonte: string;
  };
  indicadores: CCIndicador[];
}

// ── DOSSIÊ JURÍDICO (13A · seção 4) — o parecer inicial da AHRI ─────────────────
export interface DossieTese {
  posicao: number;
  ref: string;
  hipotese: string;
  confianca: 'alta' | 'media' | 'baixa';
  prioridade: number;
  justificativa: string;
  fundamento: string;
}
export interface DossieExplicacao {
  fatosUtilizados: string[];
  documentosConsiderados: string[];
  hipotesesAvaliadas: { ref: string; confianca: string }[];
  hipotesesDescartadas: { ref: string; motivo: string }[];
  estrategiaVencedora: string | null;
  confianca: string | null;
  criterios: string;
}
export interface DossieJuridico {
  clienteId: string;
  chatId: string;
  missionId: string | null;
  decisionId: string | null;
  strategyRef: string | null;
  correlationId: string | null;
  versaoCatalogo: string;
  geradoEm: string;
  grauConfianca: 'alta' | 'media' | 'baixa' | null;
  resumoExecutivo: string;
  problemaIdentificado: string | null;
  hipoteses: DossieTese[];
  evidenciasEncontradas: string[];
  evidenciasAusentes: string[];
  documentosReconhecidos: string[];
  documentosPendentes: string[];
  contratosEncontrados: string[];
  timeline: { rotulo: string; em: string | null; fonte: string }[];
  proximasAcoes: string[];
  riscos: string[];
  observacoesIA: string[];
  explicacao: DossieExplicacao;
  fonte: string;
}

// ── TIMELINE COGNITIVA (13A · seção 5) ─────────────────────────────────────────
export interface TimelineCognitivaItem {
  ordem: number;
  quando: string | null;
  responsavel: string;
  origem: string;
  titulo: string;
  descricao: string | null;
  fonte: string;
  categoria: string;
  fatosUtilizados: string[] | null;
}
export interface TimelineCognitivaData {
  chatId: string;
  timeline: TimelineCognitivaItem[];
}

// ── INTELIGÊNCIA (13A) — auditoria de como a AHRI pensa ────────────────────────
export interface EstrategiaCard {
  ref: string;
  descricao: string;
  problemaJuridico: string;
  requisitosMinimos: string[];
  fatosReforcadores: string[];
  criteriosDeExclusao: string[];
  criterioDePrioridade: number;
  documentosEsperados: string[];
  documentosOpcionais: string[];
  riscos: string[];
  proximaAcao: string;
  fundamento: string;
  usos: number;
  casos: string[];
  confiancaMedia: number | null;
  taxaAcerto: number | null;
  ultimaUtilizacao: string | null;
}
export interface HipoteseView {
  clienteId: string;
  clienteNome: string;
  hipotese: string;
  estrategiaRef: string;
  confianca: 'alta' | 'media' | 'baixa';
  prioridade: number;
  posicao: number;
  decisaoFinal: string | null;
  status: 'vencedora' | 'avaliada';
  fatosSustentam: string[];
  fatosAusentes: string[];
  documentosUtilizados: string[];
  quando: string;
  explicacao: DossieExplicacao;
}
export interface FatoConhecimento {
  clienteId: string;
  clienteNome: string;
  factKey: string;
  valor: string;
  origem: string;
  confianca: string;
  fonte: string;
}
export interface CategoriaConhecimento {
  categoria: string;
  factKey: string;
  itens: FatoConhecimento[];
}
export interface EvolucaoData {
  taxaAcerto: number;
  confiancaMedia: number;
  tempoMedioAteDecisaoMs: number;
  totalAtendimentos: number;
  estrategiasMaisUtilizadas: { chave: string; ocorrencias: number }[];
  estrategiasNuncaUtilizadas: string[];
  estrategiasMaisCorrigidas: {
    ref: string;
    correcoes: number;
    usos: number;
    taxaCorrecao: number;
  }[];
  documentosMaisFaltantes: { chave: string; ocorrencias: number }[];
  fatosDificeis: { chave: string; ocorrencias: number }[];
  historicoMensal: {
    mes: string;
    total: number;
    taxaAcerto: number;
    confiancaMedia: number;
    tempoMedioAteDecisaoMs: number;
  }[];
}

// ── PAINEL DO ADVOGADO (13A · seção 1) — cada card é um CASO ────────────────────
export interface CartaoCaso {
  chatId: string;
  clienteNome: string;
  status: string;
  grauConfianca: 'alta' | 'media' | 'baixa' | null;
  principalHipotese: string | null;
  proximaAcao: string | null;
  documentosPendentes: string[];
  tempoParadoMs: number | null;
  urgencia: 'alta' | 'media' | 'baixa';
  dossieDisponivel: boolean;
  missionId: string | null;
  advogadoResponsavel: string | null;
  href: string;
  fonte: string;
}

export interface ComponentHealth {
  component: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'FAILED';
  responseMs: number | null;
  queueDepth: number | null;
  memoryBytes: number | null;
  lastProcessedAt: string | null;
  detail: string | null;
  reportedAt: string;
}

// ── JORNADA A (R4) — a LISTA ÚNICA de clientes (status DERIVADO em leitura). ─────
// Substitui a antiga listagem por memória (removida na R4; Regra 2 — sem LEGACY).
export type ClienteStatus =
  | 'ATENDIMENTO'
  | 'COLETANDO_DOCUMENTOS'
  | 'PRONTO_AGUARDANDO_MODALIDADE'
  | 'PRONTO_AGUARDANDO_VENDA'
  | 'PRONTO_AGUARDANDO_PERICIA'
  | 'AGUARDANDO_10_DIAS'
  | 'AGUARDANDO_SOCIO'
  | 'EM_PROCESSO'
  | 'VENDIDO'
  | 'ENCERRADO';

export interface JornadaCliente {
  clienteId: string;
  chatId: string;
  missionId: string | null;
  quem: string;
  status: ClienteStatus;
  modalidade: 'VENDA' | 'SOCIEDADE' | null;
  pronto: boolean;
  faltando: string[];
  saude: 'GREEN' | 'YELLOW' | 'RED' | null;
  ultimoContatoAt: string | null;
  pedidosConfirmadosEm: string | null;
}

export interface ClientDetail {
  memory: {
    chatId: string;
    // Formato REAL da memória viva (2E): fonte estruturada {kind, ref, at}.
    // O formato antigo (sourceMessageId/observedAt/reference) derrubava o SSR
    // com TypeError em shortId(undefined) — o erro do clique no cliente.
    attributes: Array<{
      key: string;
      value: string;
      source: { kind: string; ref: string; at: string };
      confidence: number;
    }>;
    rememberedEvents: Array<{
      description: string;
      source: { kind: string; ref: string; at: string };
    }>;
    emotionsObserved: Array<{
      sentiment: string;
      source: { kind: string; ref: string; at: string };
    }>;
    documentsSent: Array<{
      ref: string;
      label: string;
      source: { kind: string; ref: string; at: string };
    }>;
    documentsPending: string[];
    stagesCompleted: Array<{ stageRef: string; source: { kind: string; ref: string; at: string } }>;
    conversationStyle: string | null;
    avgResponseMs: number | null;
    messageCount: number;
    firstContactAt: string | null;
    lastContactAt: string | null;
  };
  relationship: {
    summary: string;
    pendingDocuments: string[];
    knownName: string | null;
    startedAt: string | null;
  };
  conversation: Array<{
    kind: string;
    text: string | null;
    at: string;
    intentDirective: string | null;
    operationalRuleRef: string | null;
  }>;
  missions: Array<{ missionId: string; progress: { steps: string[] } | null }>;
}

// ── Dossiê Pericial (Decreto 2026-07-21) — o HISCON parseado para o PERITO ────
export interface ContratoHisconView {
  contrato: string;
  bancoCodigo: string | null;
  bancoNome: string | null;
  situacao: string | null;
  origemAverbacao: string | null;
  migrado: boolean;
  migradoDoContrato: string | null;
  modalidade: 'EMPRESTIMO' | 'RMC' | 'RCC';
  dataInclusao: string | null;
  competenciaInicio: string | null;
  competenciaFim: string | null;
  qtdeParcelas: number | null;
  valorParcela: number | null;
  valorEmprestado: number | null;
  valorLiberado: number | null;
  taxaJurosMensal: number | null;
  taxaJurosAnual: number | null;
  valorPago: number | null;
}

export interface BancoComContratosView {
  bancoCodigo: string | null;
  bancoNome: string;
  contratos: ContratoHisconView[];
}

/** Mapa de migração: DE contrato/banco de origem → PARA contrato/banco atual. */
export interface MigracaoView {
  deContrato: string | null;
  deBancoCodigo: string | null;
  deBancoNome: string | null;
  paraContrato: string;
  paraBancoCodigo: string | null;
  paraBancoNome: string | null;
  dataInclusao: string | null;
}

export interface DossiePericialView {
  chatId: string;
  nomeCliente: string | null;
  beneficio: {
    beneficiario: string | null;
    numeroBeneficio: string | null;
    bancoPagamento: string | null;
  };
  margens: {
    baseCalculo: number | null;
    maximoComprometimento: number | null;
    totalComprometido: number | null;
    extrapolada: number | null;
  };
  janelaAnos: number;
  porBanco: BancoComContratosView[];
  migrados: ContratoHisconView[];
  migracoes: MigracaoView[];
  filaPedidoAdministrativo: ContratoHisconView[];
  indicios: Array<{
    estrategiaRef: string;
    titulo: string;
    contratos: string[];
    fundamentoFactual: string;
  }>;
  totalContratos: number;
}

export interface MigradosDoClienteView {
  chatId: string;
  nomeCliente: string | null;
  porBanco: BancoComContratosView[];
  migracoes: MigracaoView[];
  totalMigrados: number;
  potencialMigrados: number;
}

export interface MissionRow {
  missionId: string;
  chatId: string | null;
  createdAt: string;
  eventCount: number;
  lastEventAt: string;
  truthCount: number;
  stateCount: number;
  stageCount: number;
  operationCount: number;
  projectionCount: number;
}

export interface TimelineEntry {
  globalSeq: number;
  at: string;
  recordedAt: string;
  streamType: string;
  streamId: string;
  eventType: string;
  isRelevant: boolean;
  actor: string | null;
  operationalRuleRef: string | null;
  fundamento: string | null;
  missionId: string | null;
}

export interface MissionDetail {
  missionId: string;
  chatId: string | null;
  timeline: TimelineEntry[];
  progress: { steps: string[] } | null;
}

export interface DocumentsData {
  recognized: Array<{
    documentId: string;
    missionId: string | null;
    contentReference: string | null;
    mimeType: string | null;
    recognizedAt: string;
    status: string;
  }>;
  pending: Array<{ chatId: string; document: string }>;
}

export interface StaffMember {
  id: string;
  role: string;
  name: string;
  email: string | null;
  /** CPF (só dígitos) usado como login humano do portal; null = ainda pelo id. */
  cpf?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffData {
  members: StaffMember[];
  workload: {
    role: string;
    activeMembers: number;
    inactiveMembers: number;
    openHandoffs: number;
    avgQueuePerMember: number | null;
  };
}

// ── SÓCIOS (Decreto 2026-07-23) — linha do sócio na visão do Admin: participação
// (bps + legível), se já criou senha pelo link e o valor estimado (fatia do
// potencial recuperável total de hoje).
export interface SocioAdminView {
  cpf: string;
  nome: string;
  percentualBps: number;
  percentual: string;
  ativo: boolean;
  temSenha: boolean;
  valorEstimado: number;
}

export interface FounderBriefing {
  greeting: string;
  newClients: number;
  newDocuments: number;
  newMissions: number;
  newProcesses: number;
  newStages: number;
  provenance: string;
}

export interface FounderAnswer {
  question: string;
  answer: string;
  available: boolean;
  provenance: string;
  isRecommendation: boolean;
}

export interface LogsData {
  events: TimelineEntry[];
  observations: Array<{
    kind: string;
    component: string;
    name: string;
    value: number | null;
    detail: string | null;
    at: string;
  }>;
}

export interface HealthData {
  overall: string;
  components: ComponentHealth[];
}
