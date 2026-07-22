// ─────────────────────────────────────────────────────────────────────────────
// JORNADA 1 — DOCUMENTAÇÃO INICIAL (Decreto "Jornada Documental Inicial";
// ordem revisada pelo decreto do Tráfego Pago de 2026-07-20, que REVOGA o
// "HISCON First" do 15B).
//
// A documentação inicial é FIXA. Sempre. Nunca depende do advogado:
//   1. RG (frente e verso) ou CNH (código canônico IDENTIDADE)
//   2. Comprovante de endereço (COMPROVANTE_RESIDENCIA)
//   3. HISCON (código canônico CNIS — extrato de consignações)
//
// Este módulo é a CONTABILIDADE CANÔNICA da jornada: qual documento obrigatório
// já chegou (classificação determinística sobre o TEXTO transcrito pelo Reader
// — a IA apenas transcreve; a decisão vem de regras explícitas) e qual é o
// PRÓXIMO a solicitar (ordem fixa acima — um documento por vez).
//
// Enquanto faltar QUALQUER um dos três ⇒ missão da conversa ONBOARDING_DOCUMENTAL.
// Com os três completos ⇒ ANALISE_ADMINISTRATIVA (a AHRI muda automaticamente).
// Documentos complementares NÃO pertencem a esta jornada (Jornada 2 =
// DocumentRequest, exclusivo do Painel do Advogado).
// ─────────────────────────────────────────────────────────────────────────────

/** Os TRÊS documentos obrigatórios, na ORDEM FIXA de solicitação
 *  (decreto Tráfego Pago: RG/CNH → comprovante de endereço → HISCON). */
export const DOCUMENTACAO_INICIAL = ['IDENTIDADE', 'COMPROVANTE_RESIDENCIA', 'CNIS'] as const;
export type DocumentoInicial = (typeof DOCUMENTACAO_INICIAL)[number];
export type ClassificacaoInicial = DocumentoInicial | 'OUTRO';

/** Rótulos que a AHRI usa com o cliente (nunca o código técnico). */
export const ROTULO_INICIAL: Readonly<Record<DocumentoInicial, string>> = {
  CNIS: 'HISCON (histórico de empréstimos consignados do INSS)',
  IDENTIDADE: 'RG (frente e verso) ou CNH',
  COMPROVANTE_RESIDENCIA: 'comprovante de endereço',
};

// ── Classificação determinística (regras explícitas; sem IA decidindo) ────────
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Sinais da CNH separados dos do RG (correção do teste real: CNH sozinha
// completa a identidade; RG exige FRENTE E VERSO — duas imagens).
const SINAIS_CNH = {
  frases: ['carteira nacional de habilitacao', 'habilitacao'],
  tokens: ['cnh'],
} as const;
const SINAIS_RG = {
  frases: [
    'registro geral',
    'carteira de identidade',
    'documento de identidade',
    'orgao emissor',
    'orgao expedidor',
    'filiacao',
  ],
  tokens: ['rg'],
} as const;

const SINAIS: Readonly<
  Record<DocumentoInicial, { frases: readonly string[]; tokens: readonly string[] }>
> = {
  CNIS: {
    frases: [
      'hiscon',
      'historico de emprestimo',
      'emprestimos consignados',
      'emprestimo consignado',
      'extrato de consignacoes',
      'extrato previdenciario',
      'consignad',
    ],
    tokens: ['cnis'],
  },
  IDENTIDADE: {
    frases: [...SINAIS_RG.frases, ...SINAIS_CNH.frases],
    tokens: [...SINAIS_RG.tokens, ...SINAIS_CNH.tokens],
  },
  COMPROVANTE_RESIDENCIA: {
    // 15ª rodada (conta de ÁGUA real ficou 'OUTRO'): sinais de faturas de
    // água/energia/gás — "Hidrometro: … Tipo de ligacao: AGUA E ESGOTO".
    frases: [
      'comprovante de residencia',
      'comprovante de endereco',
      'conta de luz',
      'conta de agua',
      'conta de energia',
      'energia eletrica',
      'fatura de energia',
      'saneamento',
      'telefonica',
      'hidrometro',
      'agua e esgoto',
      'abastecimento de agua',
      'fatura de agua',
      'consumo de agua',
      'tipo de ligacao',
      'sabesp',
      'copasa',
      'sanepar',
      'sanasa',
      'embasa',
      'cedae',
      'cagece',
      'energisa',
      'equatorial',
      'neoenergia',
      'comgas',
      'elektro',
      'coelba',
      'celpe',
      'celesc',
      'cemig',
      'copel',
    ],
    tokens: ['dae', 'saae', 'enel', 'cpfl', 'edp'],
  },
};

export type SubtipoIdentidade = 'rg' | 'cnh';

/** CNH ou RG? (só faz sentido quando a classificação foi IDENTIDADE).
 *  Ambíguo ⇒ 'rg' — o caminho seguro é pedir o verso; a CNH quase sempre
 *  transcreve "habilitação". */
export function detectarSubtipoIdentidade(fileName: string, texto: string): SubtipoIdentidade {
  const corpo = normalizar(`${fileName} ${texto}`);
  const tokens = new Set(corpo.split(' '));
  const pontosCnh =
    SINAIS_CNH.frases.filter((f) => corpo.includes(f)).length +
    SINAIS_CNH.tokens.filter((t) => tokens.has(t)).length;
  return pontosCnh > 0 ? 'cnh' : 'rg';
}

/**
 * Classifica um documento recebido em UM dos três obrigatórios — ou OUTRO.
 * Determinística e auditável: pontua sinais no texto transcrito + nome do
 * arquivo; decide só quando EXATAMENTE UMA categoria vence (>0). Empate ou
 * nada reconhecível ⇒ OUTRO (jamais adivinhar).
 */
export function classificarDocumentoInicial(fileName: string, texto: string): ClassificacaoInicial {
  const corpo = normalizar(`${fileName} ${texto}`);
  if (corpo === '') return 'OUTRO';
  const tokens = new Set(corpo.split(' '));
  const pontuadas = DOCUMENTACAO_INICIAL.map((codigo) => {
    const s = SINAIS[codigo];
    const pontos =
      s.frases.filter((f) => corpo.includes(f)).length +
      s.tokens.filter((t) => tokens.has(t)).length;
    return { codigo, pontos };
  });
  const max = Math.max(...pontuadas.map((p) => p.pontos));
  if (max === 0) return 'OUTRO';
  const vencedoras = pontuadas.filter((p) => p.pontos === max);
  return vencedoras.length === 1 ? (vencedoras[0] as { codigo: DocumentoInicial }).codigo : 'OUTRO';
}

// ── Estado da jornada (read model; um por conversa) ───────────────────────────
export interface DocumentoInicialRecebido {
  readonly codigo: DocumentoInicial;
  readonly documentId: string;
  readonly em: Date;
  /** Só para IDENTIDADE: RG (precisa de frente E verso) ou CNH (uma basta). */
  readonly subtipo?: SubtipoIdentidade;
}

export interface OnboardingDocumentalState {
  readonly chatId: string;
  readonly missionId: string | null;
  readonly recebidos: readonly DocumentoInicialRecebido[];
  readonly atualizadoEm: Date;
}

export function novoOnboarding(
  chatId: string,
  missionId: string | null,
  now: Date,
): OnboardingDocumentalState {
  return { chatId, missionId, recebidos: [], atualizadoEm: now };
}

/** IDENTIDADE está completa? CNH (uma) OU RG com DUAS faces (frente e verso). */
export function identidadeCompleta(state: OnboardingDocumentalState): boolean {
  const ids = state.recebidos.filter((r) => r.codigo === 'IDENTIDADE');
  if (ids.some((r) => r.subtipo === 'cnh')) return true;
  return ids.length >= 2; // RG frente + verso (entradas antigas sem subtipo contam como RG)
}

function codigoCompleto(state: OnboardingDocumentalState, codigo: DocumentoInicial): boolean {
  if (codigo === 'IDENTIDADE') return identidadeCompleta(state);
  return state.recebidos.some((r) => r.codigo === codigo);
}

/** Os códigos que ainda faltam, NA ORDEM FIXA de solicitação. */
export function faltando(state: OnboardingDocumentalState): readonly DocumentoInicial[] {
  return DOCUMENTACAO_INICIAL.filter((c) => !codigoCompleto(state, c));
}

/** O PRÓXIMO documento obrigatório a solicitar (null = jornada completa). */
export function proximo(state: OnboardingDocumentalState): DocumentoInicial | null {
  return faltando(state)[0] ?? null;
}

export function completo(state: OnboardingDocumentalState): boolean {
  return faltando(state).length === 0;
}

/** Rótulo humano do que pedir AGORA — sabe pedir "o verso do RG". */
export function rotuloDoPendente(
  state: OnboardingDocumentalState,
  codigo: DocumentoInicial,
): string {
  if (codigo === 'IDENTIDADE') {
    const rgs = state.recebidos.filter((r) => r.codigo === 'IDENTIDADE' && r.subtipo !== 'cnh');
    if (rgs.length === 1) return 'o VERSO do RG (a parte de trás do documento)';
  }
  return ROTULO_INICIAL[codigo];
}

/** Rótulo humano do que acabou de ser registrado (a última entrada). */
export function rotuloDoRegistrado(
  r: DocumentoInicialRecebido,
  state: OnboardingDocumentalState,
): string {
  if (r.codigo === 'IDENTIDADE') {
    if (r.subtipo === 'cnh') return 'CNH';
    const faces = state.recebidos.filter(
      (x) => x.codigo === 'IDENTIDADE' && x.subtipo !== 'cnh',
    ).length;
    return faces >= 2 ? 'RG (frente e verso)' : 'a primeira face do RG';
  }
  return r.codigo === 'CNIS' ? 'HISCON' : 'comprovante de endereço';
}

/** PROGRESSÃO AUTOMÁTICA da triagem (5ª rodada — solução definitiva): quando o
 *  registro conclui, a AHRI AVISA sozinha e pede o próximo — mensagem AUTORADA
 *  e determinística; zero improviso de LLM no passo mais crítico do funil. */
export function mensagemDeProgresso(state: OnboardingDocumentalState): string {
  const ultimo = state.recebidos[state.recebidos.length - 1];
  const registrado = ultimo !== undefined ? rotuloDoRegistrado(ultimo, state) : 'documento';
  const prox = proximo(state);
  if (prox === null) {
    return `✅ Registrado: ${registrado}! Com isso sua documentação inicial está completa — já te mando os próximos passos.`;
  }
  return `✅ Registrado: ${registrado}! Agora me manda, por favor: ${rotuloDoPendente(state, prox)}.`;
}

// ── Portas ────────────────────────────────────────────────────────────────────
export interface OnboardingDocumentalStore {
  load(chatId: string): Promise<OnboardingDocumentalState | null>;
  save(state: OnboardingDocumentalState): Promise<void>;
}

/** O texto TRANSCRITO de um documento (Reader/Vision — a IA só transcreve). */
export interface LeitorDeTexto {
  texto(documentId: string): Promise<string | null>;
}

/** Sincroniza a contabilidade de pendências (ALIR/Readiness — códigos canônicos). */
export interface PendenciasSync {
  setPendingDocuments(chatId: string, labels: readonly string[]): Promise<void>;
}

export interface OnboardingRuntimeDeps {
  readonly store: OnboardingDocumentalStore;
  readonly leitor: LeitorDeTexto | null;
  readonly pendencias: PendenciasSync | null;
}

export interface ResultadoDeRecebimento {
  readonly classificacao: ClassificacaoInicial;
  readonly jaRecebido: boolean;
  readonly faltando: readonly DocumentoInicial[];
  /** true ⇒ não havia texto legível E o nome do arquivo não bastou — vale REtentar. */
  readonly classificacaoPendente: boolean;
  /** Registro NOVO concluído ⇒ a mensagem AUTORADA de progressão da triagem
   *  ("✅ Registrado: X! Agora me manda: Y") — null quando nada novo entrou. */
  readonly progresso: string | null;
  /** Excerto do texto transcrito usado na classificação (diagnóstico do
   *  classificador — 14ª rodada: 'OUTRO' com texto presente era mudo). */
  readonly textoExcerto?: string | null;
}

export class OnboardingDocumentalRuntime {
  constructor(private readonly deps: OnboardingRuntimeDeps) {}

  /** Semeia a jornada quando a missão nasce: os TRÊS pendentes desde o início. */
  async aoCriarMissao(chatId: string, missionId: string, now: Date): Promise<void> {
    const atual = await this.deps.store.load(chatId);
    const state: OnboardingDocumentalState = atual
      ? { ...atual, missionId: atual.missionId ?? missionId, atualizadoEm: now }
      : novoOnboarding(chatId, missionId, now);
    await this.deps.store.save(state);
    await this.sincronizarPendencias(state);
  }

  /** Um documento chegou: classifica (regras explícitas) e atualiza a jornada. */
  async aoReconhecerDocumento(
    chatId: string,
    missionId: string | null,
    documentId: string,
    fileName: string,
    now: Date,
  ): Promise<ResultadoDeRecebimento> {
    const atual = (await this.deps.store.load(chatId)) ?? novoOnboarding(chatId, missionId, now);
    if (completo(atual)) {
      // Jornada 1 já concluída: documentos novos pertencem ao acervo/Jornada 2.
      return {
        classificacao: 'OUTRO',
        jaRecebido: false,
        faltando: [],
        classificacaoPendente: false,
        progresso: null,
      };
    }

    const texto =
      this.deps.leitor !== null ? await this.deps.leitor.texto(documentId).catch(() => null) : null;
    const classificacao = classificarDocumentoInicial(fileName, texto ?? '');
    if (classificacao === 'OUTRO') {
      // Sem texto legível AINDA (o vínculo de mídia é assíncrono) ⇒ vale retentar.
      return {
        classificacao,
        jaRecebido: false,
        faltando: faltando(atual),
        classificacaoPendente: texto === null,
        progresso: null,
        textoExcerto: texto === null ? null : texto.slice(0, 200),
      };
    }
    // Já completo para este código ⇒ reenvio não duplica. IDENTIDADE via RG
    // aceita a SEGUNDA face (frente + verso) antes de fechar.
    if (codigoCompleto(atual, classificacao)) {
      return {
        classificacao,
        jaRecebido: true,
        faltando: faltando(atual),
        classificacaoPendente: false,
        progresso: null,
      };
    }

    const recebido: DocumentoInicialRecebido = {
      codigo: classificacao,
      documentId,
      em: now,
      ...(classificacao === 'IDENTIDADE'
        ? { subtipo: detectarSubtipoIdentidade(fileName, texto ?? '') }
        : {}),
    };
    const state: OnboardingDocumentalState = {
      ...atual,
      missionId: atual.missionId ?? missionId,
      recebidos: [...atual.recebidos, recebido],
      atualizadoEm: now,
    };
    await this.deps.store.save(state);
    await this.sincronizarPendencias(state);
    return {
      classificacao,
      jaRecebido: false,
      faltando: faltando(state),
      classificacaoPendente: false,
      progresso: mensagemDeProgresso(state),
    };
  }

  /** A jornada está 100%? (fonte do estado ANALISE_ADMINISTRATIVA da conversa) */
  async estaCompleto(chatId: string): Promise<boolean> {
    const state = await this.deps.store.load(chatId);
    return state !== null && completo(state);
  }

  /** Visão para a CONVERSA (rótulos humanos; nunca códigos técnicos).
   *  Sabe pedir "o verso do RG" quando só a frente chegou. Expõe também o
   *  ÚLTIMO registro (rótulo + quando) — o Journey Runtime compara com o
   *  timestamp do turno para saber se o estado JÁ reflete o documento enviado. */
  async visao(chatId: string): Promise<{
    readonly recebidos: readonly string[];
    readonly faltando: readonly string[];
    readonly proximo: string | null;
    readonly ultimoRegistrado: string | null;
    readonly ultimoRegistroEm: Date | null;
  } | null> {
    const state = await this.deps.store.load(chatId);
    if (state === null) return null;
    const prox = proximo(state);
    const rotuloRecebido = (r: DocumentoInicialRecebido): string =>
      r.codigo === 'IDENTIDADE'
        ? r.subtipo === 'cnh'
          ? 'CNH'
          : 'RG (uma das faces)'
        : ROTULO_INICIAL[r.codigo];
    const ultimo = state.recebidos[state.recebidos.length - 1] ?? null;
    return {
      recebidos: state.recebidos.map(rotuloRecebido),
      faltando: faltando(state).map((c) => rotuloDoPendente(state, c)),
      proximo: prox !== null ? rotuloDoPendente(state, prox) : null,
      ultimoRegistrado: ultimo !== null ? rotuloDoRegistrado(ultimo, state) : null,
      ultimoRegistroEm: ultimo !== null ? ultimo.em : null,
    };
  }

  /** Pendências por CÓDIGO canônico → ALIR/Readiness (a mesma verdade em toda parte). */
  private async sincronizarPendencias(state: OnboardingDocumentalState): Promise<void> {
    if (this.deps.pendencias === null) return;
    await this.deps.pendencias
      .setPendingDocuments(state.chatId, faltando(state))
      .catch(() => undefined);
  }
}
