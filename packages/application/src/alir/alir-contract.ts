// ─────────────────────────────────────────────────────────────────────────────
// ALIR — CONTRATO OFICIAL (W1-01B · B-1). O ALIR é um AGGREGATE OPERACIONAL de
// LEITURA (read model): a identidade operacional do cliente — o "sistema solar"
// em torno do qual tudo orbita. Ele NÃO é fonte de verdade: cada campo aponta para
// uma fonte CANÔNICA/DERIVADA já existente, é CALCULADO em leitura, ou é um SLOT
// ausente declarado. Logo o ALIR é sempre 100% reconstruível e JAMAIS duplica dado.
//
// Divisão do Aggregate: CORE (identidade imutável) · OPERATIONAL (estado vivo do
// caso) · EXTENSIONS (órbitas cujo produtor ainda nascerá — slots nulos honestos).
// Este arquivo entrega SOMENTE o contrato (tipos + metadados + fábrica vazia).
// Nenhuma projeção, cache, subscriber, tabela, interface, API ou tela aqui.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReadModel } from '@reconstrua/domain';

/**
 * Versão do esquema do contrato (versionamento — invalida caches após evolução).
 * v2 (BREAKING, Regra 4): removido o campo `capabilities` (e o tipo ALIRCapability) —
 * nenhum consumidor real surgiu nas Jornadas A/B; a operação decide por STATUS
 * derivado, não por capacidades. Remoção homologada na auditoria final do GO LIVE B.
 */
export const ALIR_SCHEMA_VERSION = 2 as const;

// ── Vocabulários (arrays em runtime → também servem à validação de testes) ───────

/** Classificação obrigatória de todo dado do ALIR (evita duplicação futura). */
export const ALIR_CLASSIFICATIONS = ['CANONICO', 'DERIVADO', 'CALCULADO', 'TEMPORARIO', 'EXTERNO'] as const;
export type ALIRClassification = (typeof ALIR_CLASSIFICATIONS)[number];

/** Seções do Aggregate. META = campos de cabeçalho/computados do agregado. */
export const ALIR_SECTIONS = ['META', 'CORE', 'OPERATIONAL', 'EXTENSIONS'] as const;
export type ALIRSection = (typeof ALIR_SECTIONS)[number];

/**
 * OWNER de cada campo: o produtor real responsável pelo dado. `alir-runtime` só
 * pode ser dono de dado CALCULADO (o ALIR nunca produz verdade). `pending-producer`
 * marca os slots de EXTENSIONS cujo produtor ainda nascerá (W1-03/04, Ondas 2/3).
 */
export const ALIR_OWNERS = [
  'alir-runtime',
  'pending-producer',
  'r1-recognize-person',
  'r2-recognize-cliente',
  'r3-recognize-document',
  'r6-operational-synthesis',
  'mission-runtime',
  'workflow-runtime',
  'scheduler-runtime',
  'human-handoff-runtime',
  'administrador',
  'advogado',
  'executive-brain',
  'living-memory',
  'shadow',
  'event-store',
  'production-config',
] as const;
export type ALIROwner = (typeof ALIR_OWNERS)[number];

// ── CORE — identidade imutável do cliente ────────────────────────────────────────

export interface ALIRPersonAttribute {
  readonly key: string;
  readonly value: string;
}

export interface ALIRPessoa {
  readonly personId: string | null;
  /** Identidade civil — representação OPACA (DF-23). O ALIR não a interpreta. */
  readonly identidadeCivil: string | null;
  readonly origemReconhecimento: string | null;
  readonly atributos: readonly ALIRPersonAttribute[];
}

export interface ALIRCore {
  readonly pessoa: ALIRPessoa;
}

// ── OPERATIONAL — estado vivo do caso ────────────────────────────────────────────

export interface ALIRDocumentRef {
  readonly documentId: string;
  readonly mime: string | null;
  readonly sha256: string | null;
  readonly label: string | null;
}

export interface ALIRDocumentos {
  readonly enviados: readonly ALIRDocumentRef[];
  /** Códigos de documentos ainda pendentes (projetados; sem invenção). */
  readonly pendentes: readonly string[];
}

export interface ALIRAcompanhamento {
  readonly pendentes: number;
  readonly proximoVencimentoAt: Date | null;
}

export interface ALIRMissao {
  readonly missionId: string | null;
  readonly caseId: string | null;
  readonly processId: string | null;
  readonly stageCode: string | null;
  readonly stateCode: string | null;
  readonly truthEstablished: boolean;
  readonly terminalState: 'ENCERRADA' | null;
  /** Passos de workflow já atingidos (códigos). */
  readonly progresso: readonly string[];
  readonly acompanhamento: ALIRAcompanhamento;
}

export interface ALIRAhri {
  readonly estiloConversa: string | null;
  readonly tempoRespostaMedioMs: number | null;
  readonly primeiroContatoAt: Date | null;
  readonly ultimoContatoAt: Date | null;
  /** Resumo do último sinal de qualidade (Shadow), sem PII. */
  readonly qualidade: string | null;
}

export interface ALIRHandoff {
  readonly id: string;
  readonly role: string;
  readonly reasonCode: string;
  readonly status: string;
}

export interface ALIRAtribuicao {
  readonly advogadoId: string;
  readonly assignedBy: string;
  readonly assignedAt: Date;
}

export interface ALIRResponsavel {
  readonly id: string;
  readonly role: string;
  readonly name: string;
}

export interface ALIROperacao {
  readonly handoffsAbertos: readonly ALIRHandoff[];
  readonly atribuicao: ALIRAtribuicao | null;
  readonly responsaveis: readonly ALIRResponsavel[];
}

export interface ALIRJuridicalItem {
  readonly id: string;
  readonly kind: string;
  readonly text: string;
  readonly dueAt: Date | null;
  readonly done: boolean;
}

export interface ALIRJuridico {
  /** Referência do processo (nº), quando houver. */
  readonly processoRef: string | null;
  readonly pendencias: readonly ALIRJuridicalItem[];
}

export interface ALIRTimelineEntry {
  readonly eventId: string;
  readonly type: string;
  readonly at: Date;
}

export interface ALIRDecisionRef {
  readonly id: string;
  readonly type: string;
  readonly status: string;
}

export interface ALIRProximaAcao {
  readonly code: string;
  /** conversation | wait | stop | escalation (natureza da ação primária). */
  readonly kind: string;
  readonly rationale: string;
}

export interface ALIROperational {
  readonly missao: ALIRMissao;
  readonly documentos: ALIRDocumentos;
  readonly ahri: ALIRAhri;
  readonly operacao: ALIROperacao;
  readonly juridico: ALIRJuridico;
  readonly timeline: readonly ALIRTimelineEntry[];
  readonly decisoes: readonly ALIRDecisionRef[];
  readonly proximaAcao: ALIRProximaAcao | null;
}

// ── EXTENSIONS — órbitas sem produtor hoje (slots nulos honestos) ────────────────

export interface ALIRPericia {
  readonly laudoId: string;
  readonly resultado: 'CONFIRMADO' | 'AFASTADO';
}

export interface ALIREstagioComercial {
  /** Código do funil comercial (1→12). */
  readonly code: string;
  readonly label: string;
}

export interface ALIRComercial {
  readonly modelo: 'A' | 'B' | null;
  readonly situacao: string;
}

export interface ALIRFinanceiro {
  readonly aReceber: number | null;
  readonly recebido: number | null;
  readonly moeda: string;
}

export interface ALIREscritorio {
  readonly escritorioId: string;
  readonly nome: string;
}

export interface ALIRPortalCliente {
  readonly ativo: boolean;
}

export interface ALIRExtensions {
  readonly pericia: ALIRPericia | null;
  readonly estagioComercial: ALIREstagioComercial | null;
  readonly comercial: ALIRComercial | null;
  readonly financeiro: ALIRFinanceiro | null;
  readonly escritorio: ALIREscritorio | null;
  readonly portalCliente: ALIRPortalCliente | null;
}

// ── Computados de agregado (Health Score + Capacidades) ──────────────────────────

export type ALIRHealthBand = 'GREEN' | 'YELLOW' | 'RED';

export interface ALIRHealthScore {
  /** 0..100. */
  readonly score: number;
  readonly band: ALIRHealthBand;
  /** Motivos legíveis (sem PII). */
  readonly reasons: readonly string[];
}

// ── O AGGREGATE OPERACIONAL ──────────────────────────────────────────────────────

export interface ALIR extends ReadModel {
  /** Identidade do cliente (raiz do agregado). */
  readonly clienteId: string;
  /** Chave de contato (WhatsApp). */
  readonly chatId: string;
  readonly schemaVersion: number;
  /** Hash do conteúdo projetado; `null` até a composição (W1-01B/B-6). */
  readonly contentHash: string | null;
  readonly core: ALIRCore;
  readonly operational: ALIROperational;
  readonly extensions: ALIRExtensions;
  /** CALCULADO — saúde operacional do caso; `null` até computado. */
  readonly healthScore: ALIRHealthScore | null;
}

/**
 * Fábrica do ALIR VAZIO — projeção mínima válida (cliente novo/desconhecido). Sem
 * heurística: extensões nulas, computados neutros, listas vazias. Espelha a
 * disciplina de `emptySnapshot`/`emptyMetrics` (nada inventado).
 */
export function emptyALIR(clienteId: string, chatId: string, now: Date): ALIR {
  return {
    projectedAt: now,
    clienteId,
    chatId,
    schemaVersion: ALIR_SCHEMA_VERSION,
    contentHash: null,
    core: {
      pessoa: { personId: null, identidadeCivil: null, origemReconhecimento: null, atributos: [] },
    },
    operational: {
      missao: {
        missionId: null,
        caseId: null,
        processId: null,
        stageCode: null,
        stateCode: null,
        truthEstablished: false,
        terminalState: null,
        progresso: [],
        acompanhamento: { pendentes: 0, proximoVencimentoAt: null },
      },
      documentos: { enviados: [], pendentes: [] },
      ahri: {
        estiloConversa: null,
        tempoRespostaMedioMs: null,
        primeiroContatoAt: null,
        ultimoContatoAt: null,
        qualidade: null,
      },
      operacao: { handoffsAbertos: [], atribuicao: null, responsaveis: [] },
      juridico: { processoRef: null, pendencias: [] },
      timeline: [],
      decisoes: [],
      proximaAcao: null,
    },
    extensions: {
      pericia: null,
      estagioComercial: null,
      comercial: null,
      financeiro: null,
      escritorio: null,
      portalCliente: null,
    },
    healthScore: null,
  };
}

// ── REGISTRY DE CAMPOS (owners + metadados auto-documentados) ─────────────────────

/**
 * Metadado obrigatório de cada campo do ALIR. É a documentação viva (em código) do
 * contrato: descrição, classificação, owner, origem e reconstruível — para nunca se
 * perder de onde vem cada dado e garantir que o ALIR não vira fonte de verdade.
 */
export interface ALIRFieldMeta {
  /** Caminho canônico do campo (ex.: 'operational.missao.stateCode'). */
  readonly path: string;
  readonly section: ALIRSection;
  readonly description: string;
  readonly classification: ALIRClassification;
  readonly owner: ALIROwner;
  /** Fonte real (namespace/stream/arquivo) ou 'ausente — nasce em …' para slots. */
  readonly origin: string;
  readonly reconstructable: boolean;
}

/** Catálogo oficial: todo campo do ALIR e sua procedência. */
export const ALIR_FIELDS: readonly ALIRFieldMeta[] = [
  // META
  { path: 'clienteId', section: 'META', description: 'Identidade do cliente (raiz do agregado).', classification: 'CANONICO', owner: 'r2-recognize-cliente', origin: 'identities (MissionIdentity.clienteId)', reconstructable: true },
  { path: 'chatId', section: 'META', description: 'Chave de contato do cliente (WhatsApp).', classification: 'CANONICO', owner: 'r1-recognize-person', origin: 'identities (MissionIdentity.chatId)', reconstructable: true },
  { path: 'projectedAt', section: 'META', description: 'Momento da recomposição da projeção.', classification: 'CALCULADO', owner: 'alir-runtime', origin: 'ALIR Runtime (recomposição)', reconstructable: true },
  { path: 'schemaVersion', section: 'META', description: 'Versão do esquema do contrato ALIR.', classification: 'CALCULADO', owner: 'alir-runtime', origin: 'ALIR contract', reconstructable: true },
  { path: 'contentHash', section: 'META', description: 'Hash do conteúdo projetado (versionamento/divergência).', classification: 'CALCULADO', owner: 'alir-runtime', origin: 'ALIR Runtime (hash do conteúdo)', reconstructable: true },
  { path: 'healthScore', section: 'META', description: 'Saúde operacional do caso (derivada das órbitas).', classification: 'CALCULADO', owner: 'alir-runtime', origin: 'ALIR Runtime (derivado das órbitas)', reconstructable: true },

  // CORE
  { path: 'core.pessoa.personId', section: 'CORE', description: 'Identidade da Pessoa reconhecida.', classification: 'CANONICO', owner: 'r2-recognize-cliente', origin: 'identities.personId / stream person', reconstructable: true },
  { path: 'core.pessoa.identidadeCivil', section: 'CORE', description: 'Identidade civil opaca (DF-23).', classification: 'CANONICO', owner: 'r2-recognize-cliente', origin: 'stream person (CivilIdentity)', reconstructable: true },
  { path: 'core.pessoa.origemReconhecimento', section: 'CORE', description: 'Origem do reconhecimento (DF-23).', classification: 'CANONICO', owner: 'r2-recognize-cliente', origin: 'stream person (RecognitionOrigin)', reconstructable: true },
  { path: 'core.pessoa.atributos', section: 'CORE', description: 'Atributos lembrados da pessoa (nome, cidade…).', classification: 'DERIVADO', owner: 'living-memory', origin: 'client-memory.attributes', reconstructable: true },

  // OPERATIONAL — missão
  { path: 'operational.missao.missionId', section: 'OPERATIONAL', description: 'Missão (caso) corrente.', classification: 'CANONICO', owner: 'mission-runtime', origin: 'identities.missionId', reconstructable: true },
  { path: 'operational.missao.caseId', section: 'OPERATIONAL', description: 'Caso vinculado.', classification: 'CANONICO', owner: 'mission-runtime', origin: 'identities.caseId', reconstructable: true },
  { path: 'operational.missao.processId', section: 'OPERATIONAL', description: 'Processo vinculado.', classification: 'CANONICO', owner: 'mission-runtime', origin: 'identities.processId', reconstructable: true },
  { path: 'operational.missao.stageCode', section: 'OPERATIONAL', description: 'Etapa operacional atual.', classification: 'DERIVADO', owner: 'r6-operational-synthesis', origin: 'operational-stage / MissionSnapshot', reconstructable: true },
  { path: 'operational.missao.stateCode', section: 'OPERATIONAL', description: 'Estado operacional atual.', classification: 'DERIVADO', owner: 'r6-operational-synthesis', origin: 'operational-state / MissionSnapshot', reconstructable: true },
  { path: 'operational.missao.truthEstablished', section: 'OPERATIONAL', description: 'A Verdade Operacional já foi sintetizada.', classification: 'DERIVADO', owner: 'r6-operational-synthesis', origin: 'decision-state.truthEstablished', reconstructable: true },
  { path: 'operational.missao.terminalState', section: 'OPERATIONAL', description: 'Estado terminal (ENCERRADA) quando encerrado.', classification: 'DERIVADO', owner: 'mission-runtime', origin: 'decision-state.terminalState (Close/Reopen)', reconstructable: true },
  { path: 'operational.missao.progresso', section: 'OPERATIONAL', description: 'Passos de workflow atingidos.', classification: 'DERIVADO', owner: 'workflow-runtime', origin: 'workflow (MissionProgress.steps)', reconstructable: true },
  { path: 'operational.missao.acompanhamento', section: 'OPERATIONAL', description: 'Acompanhamentos agendados/pendentes.', classification: 'TEMPORARIO', owner: 'scheduler-runtime', origin: 'scheduler (ScheduledTask)', reconstructable: true },

  // OPERATIONAL — documentos
  { path: 'operational.documentos.enviados', section: 'OPERATIONAL', description: 'Documentos recebidos e vinculados.', classification: 'CANONICO', owner: 'r3-recognize-document', origin: 'document-link / stream document', reconstructable: true },
  { path: 'operational.documentos.pendentes', section: 'OPERATIONAL', description: 'Documentos ainda pendentes (códigos).', classification: 'DERIVADO', owner: 'living-memory', origin: 'client-memory.documentsPending', reconstructable: true },

  // OPERATIONAL — AHRI
  { path: 'operational.ahri.estiloConversa', section: 'OPERATIONAL', description: 'Estilo de conversa derivado.', classification: 'DERIVADO', owner: 'living-memory', origin: 'client-memory.conversationStyle', reconstructable: true },
  { path: 'operational.ahri.tempoRespostaMedioMs', section: 'OPERATIONAL', description: 'Tempo médio de resposta do cliente.', classification: 'DERIVADO', owner: 'living-memory', origin: 'client-memory.avgResponseMs', reconstructable: true },
  { path: 'operational.ahri.primeiroContatoAt', section: 'OPERATIONAL', description: 'Primeiro contato do cliente.', classification: 'DERIVADO', owner: 'living-memory', origin: 'client-memory.firstContactAt', reconstructable: true },
  { path: 'operational.ahri.ultimoContatoAt', section: 'OPERATIONAL', description: 'Último contato do cliente.', classification: 'DERIVADO', owner: 'living-memory', origin: 'client-memory.lastContactAt', reconstructable: true },
  { path: 'operational.ahri.qualidade', section: 'OPERATIONAL', description: 'Sinal de qualidade do atendimento (Shadow).', classification: 'EXTERNO', owner: 'shadow', origin: 'shadow (ShadowReport)', reconstructable: true },

  // OPERATIONAL — operação
  { path: 'operational.operacao.handoffsAbertos', section: 'OPERATIONAL', description: 'Escalonamentos humanos abertos.', classification: 'CANONICO', owner: 'human-handoff-runtime', origin: 'handoff (HandoffTask)', reconstructable: true },
  { path: 'operational.operacao.atribuicao', section: 'OPERATIONAL', description: 'Atribuição do caso a advogado.', classification: 'CANONICO', owner: 'administrador', origin: 'assignments (CaseAssignment)', reconstructable: true },
  { path: 'operational.operacao.responsaveis', section: 'OPERATIONAL', description: 'Responsáveis alocados ao caso.', classification: 'CANONICO', owner: 'administrador', origin: 'staff (StaffMember)', reconstructable: true },

  // OPERATIONAL — jurídico
  { path: 'operational.juridico.processoRef', section: 'OPERATIONAL', description: 'Referência do processo (nº).', classification: 'CANONICO', owner: 'advogado', origin: 'stream process / juridical', reconstructable: true },
  { path: 'operational.juridico.pendencias', section: 'OPERATIONAL', description: 'Pendências jurídicas (prazos/documentos).', classification: 'CANONICO', owner: 'advogado', origin: 'juridical (JuridicalEntry)', reconstructable: true },

  // OPERATIONAL — timeline / decisões / próxima ação
  { path: 'operational.timeline', section: 'OPERATIONAL', description: 'Histórico de eventos do cliente.', classification: 'CANONICO', owner: 'event-store', origin: 'event store (streams do cliente)', reconstructable: true },
  { path: 'operational.decisoes', section: 'OPERATIONAL', description: 'Decisões registradas (auditoria).', classification: 'CANONICO', owner: 'event-store', origin: 'decisions / event store', reconstructable: true },
  { path: 'operational.proximaAcao', section: 'OPERATIONAL', description: 'Próxima melhor ação para o caso.', classification: 'CALCULADO', owner: 'executive-brain', origin: 'NextBestActionPlanner (Brain)', reconstructable: true },

  // EXTENSIONS — slots sem produtor hoje (declarados, nunca inventados)
  { path: 'extensions.pericia', section: 'EXTENSIONS', description: 'Laudo/resultado da perícia.', classification: 'CANONICO', owner: 'pending-producer', origin: 'ausente — nasce em W1-03', reconstructable: true },
  { path: 'extensions.estagioComercial', section: 'EXTENSIONS', description: 'Estágio no funil comercial (1→12).', classification: 'DERIVADO', owner: 'pending-producer', origin: 'ausente — nasce em W1-04', reconstructable: true },
  { path: 'extensions.comercial', section: 'EXTENSIONS', description: 'Situação comercial (venda/sociedade).', classification: 'CANONICO', owner: 'pending-producer', origin: 'ausente — nasce em Onda 2/3', reconstructable: true },
  { path: 'extensions.financeiro', section: 'EXTENSIONS', description: 'Situação financeira (honorário/distribuição/a receber).', classification: 'CANONICO', owner: 'pending-producer', origin: 'ausente — nasce em Onda 3', reconstructable: true },
  { path: 'extensions.escritorio', section: 'EXTENSIONS', description: 'Escritório parceiro vinculado.', classification: 'CANONICO', owner: 'pending-producer', origin: 'ausente — nasce em Onda 2', reconstructable: true },
  { path: 'extensions.portalCliente', section: 'EXTENSIONS', description: 'Situação do portal do cliente.', classification: 'EXTERNO', owner: 'pending-producer', origin: 'ausente — nasce no futuro', reconstructable: true },
];

/** Busca o metadado de um campo pelo caminho canônico. */
export function alirFieldByPath(path: string): ALIRFieldMeta | null {
  return ALIR_FIELDS.find((f) => f.path === path) ?? null;
}

/**
 * Quem é o cliente — nome lembrado ou o rótulo honesto de não identificado.
 * Helper ÚNICO (dedup R2→R3): persona e listagem leem por aqui.
 */
export function alirQuem(alir: ALIR): string {
  const nome = alir.core.pessoa.atributos.find((a) => a.key === 'nome');
  return nome !== undefined ? nome.value : 'contato não identificado';
}
