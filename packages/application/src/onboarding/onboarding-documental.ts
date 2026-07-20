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
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const SINAIS: Readonly<Record<DocumentoInicial, { frases: readonly string[]; tokens: readonly string[] }>> = {
  CNIS: {
    frases: ['hiscon', 'historico de emprestimo', 'emprestimos consignados', 'emprestimo consignado', 'extrato de consignacoes', 'extrato previdenciario', 'consignad'],
    tokens: ['cnis'],
  },
  IDENTIDADE: {
    frases: ['registro geral', 'carteira de identidade', 'carteira nacional de habilitacao', 'documento de identidade', 'orgao emissor', 'orgao expedidor', 'filiacao'],
    tokens: ['rg', 'cnh'],
  },
  COMPROVANTE_RESIDENCIA: {
    frases: ['comprovante de residencia', 'comprovante de endereco', 'conta de luz', 'conta de agua', 'conta de energia', 'energia eletrica', 'fatura de energia', 'saneamento', 'telefonica'],
    tokens: [],
  },
};

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
      s.frases.filter((f) => corpo.includes(f)).length + s.tokens.filter((t) => tokens.has(t)).length;
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
}

export interface OnboardingDocumentalState {
  readonly chatId: string;
  readonly missionId: string | null;
  readonly recebidos: readonly DocumentoInicialRecebido[];
  readonly atualizadoEm: Date;
}

export function novoOnboarding(chatId: string, missionId: string | null, now: Date): OnboardingDocumentalState {
  return { chatId, missionId, recebidos: [], atualizadoEm: now };
}

/** Os códigos que ainda faltam, NA ORDEM FIXA de solicitação. */
export function faltando(state: OnboardingDocumentalState): readonly DocumentoInicial[] {
  const tem = new Set(state.recebidos.map((r) => r.codigo));
  return DOCUMENTACAO_INICIAL.filter((c) => !tem.has(c));
}

/** O PRÓXIMO documento obrigatório a solicitar (null = jornada completa). */
export function proximo(state: OnboardingDocumentalState): DocumentoInicial | null {
  return faltando(state)[0] ?? null;
}

export function completo(state: OnboardingDocumentalState): boolean {
  return faltando(state).length === 0;
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
      return { classificacao: 'OUTRO', jaRecebido: false, faltando: [], classificacaoPendente: false };
    }

    const texto = this.deps.leitor !== null ? await this.deps.leitor.texto(documentId).catch(() => null) : null;
    const classificacao = classificarDocumentoInicial(fileName, texto ?? '');
    if (classificacao === 'OUTRO') {
      // Sem texto legível AINDA (o vínculo de mídia é assíncrono) ⇒ vale retentar.
      return { classificacao, jaRecebido: false, faltando: faltando(atual), classificacaoPendente: texto === null };
    }
    if (atual.recebidos.some((r) => r.codigo === classificacao)) {
      return { classificacao, jaRecebido: true, faltando: faltando(atual), classificacaoPendente: false };
    }

    const state: OnboardingDocumentalState = {
      ...atual,
      missionId: atual.missionId ?? missionId,
      recebidos: [...atual.recebidos, { codigo: classificacao, documentId, em: now }],
      atualizadoEm: now,
    };
    await this.deps.store.save(state);
    await this.sincronizarPendencias(state);
    return { classificacao, jaRecebido: false, faltando: faltando(state), classificacaoPendente: false };
  }

  /** A jornada está 100%? (fonte do estado ANALISE_ADMINISTRATIVA da conversa) */
  async estaCompleto(chatId: string): Promise<boolean> {
    const state = await this.deps.store.load(chatId);
    return state !== null && completo(state);
  }

  /** Visão para a CONVERSA (rótulos humanos; nunca códigos técnicos). */
  async visao(chatId: string): Promise<{
    readonly recebidos: readonly string[];
    readonly faltando: readonly string[];
    readonly proximo: string | null;
  } | null> {
    const state = await this.deps.store.load(chatId);
    if (state === null) return null;
    const prox = proximo(state);
    return {
      recebidos: state.recebidos.map((r) => ROTULO_INICIAL[r.codigo]),
      faltando: faltando(state).map((c) => ROTULO_INICIAL[c]),
      proximo: prox !== null ? ROTULO_INICIAL[prox] : null,
    };
  }

  /** Pendências por CÓDIGO canônico → ALIR/Readiness (a mesma verdade em toda parte). */
  private async sincronizarPendencias(state: OnboardingDocumentalState): Promise<void> {
    if (this.deps.pendencias === null) return;
    await this.deps.pendencias.setPendingDocuments(state.chatId, faltando(state)).catch(() => undefined);
  }
}
