// ─────────────────────────────────────────────────────────────────────────────
// JORNADA 1 — DOCUMENTAÇÃO INICIAL (Decreto "Jornada Documental Inicial";
// REFORMULADA pelo decreto HISCON-ONLY de 2026-07-22, que revoga a ordem de
// três documentos do Tráfego Pago).
//
// A documentação inicial agora é UM ÚNICO documento:
//   1. HISCON (código canônico CNIS — extrato de empréstimos consignados)
//
// A AHRI explica o trabalho, tira dúvidas sobre irregularidades e direitos,
// coleta nome + cidade e, com o interesse confirmado, pede APENAS o HISCON.
// A análise/perícia estuda o HISCON e gera o dossiê; ENCONTRADAS
// irregularidades, o contato é retomado e o RESTANTE da documentação
// (RG/CNH, comprovante de endereço, procuração) é solicitado PELO ADVOGADO
// via DocumentRequest (Jornada 2 — Painel do Advogado, com presets).
//
// O classificador continua reconhecendo RG/CNH e comprovante (o cliente pode
// enviar espontaneamente e o registro é aproveitado) — mas só o HISCON é
// OBRIGATÓRIO para a jornada inicial completar.
//
// Enquanto faltar o HISCON ⇒ missão da conversa ONBOARDING_DOCUMENTAL.
// Com o HISCON ⇒ ANALISE_ADMINISTRATIVA (a AHRI muda automaticamente).
// ─────────────────────────────────────────────────────────────────────────────

import { contratosDaJanela, parseHisconDetalhado } from '../pericia/hiscon-parser.js';

/** Os documentos que o classificador RECONHECE (tipo canônico). */
export const DOCUMENTOS_CONHECIDOS = ['IDENTIDADE', 'COMPROVANTE_RESIDENCIA', 'CNIS'] as const;
export type DocumentoInicial = (typeof DOCUMENTOS_CONHECIDOS)[number];
export type ClassificacaoInicial = DocumentoInicial | 'OUTRO';

/** O(s) documento(s) OBRIGATÓRIO(S) da jornada inicial — decreto HISCON-ONLY
 *  (2026-07-22): apenas o HISCON; o restante é do advogado (Jornada 2). */
export const DOCUMENTACAO_INICIAL: readonly DocumentoInicial[] = ['CNIS'];

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
    // Cliente real 2026-07-22 (21 97449-1893): DECLARAÇÃO DE RESIDÊNCIA
    // (documento assinado declarando onde mora) também é comprovante válido.
    frases: [
      'comprovante de residencia',
      'comprovante de endereco',
      'declaracao de residencia',
      'declaracao de endereco',
      'declaro que resido',
      'declaro para os devidos fins que resido',
      'declaro ser residente',
      'residente e domiciliad',
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

// Sinais de HISTÓRICO DE CRÉDITO (SCR/Registrato do Banco Central, relatórios de
// bureau) — documento que a cliente às vezes confunde com o HISCON. Ele CITA
// "consignado" entre as operações de crédito, mas NÃO é o extrato do INSS.
const SINAIS_HISTORICO_CREDITO: readonly string[] = [
  'historico de credito',
  'sistema de informacoes de credito',
  'registrato',
  'score de credito',
  'score',
  'consultas ao seu cpf',
  'operacoes de credito',
  'relatorio de credito',
  'cadastro positivo',
  'serasa',
  'spc brasil',
  'boa vista',
  'cheque especial',
  'cartao de credito',
  'limite de credito',
];

// Sinais FORTES de que É o HISCON de verdade (o extrato do Meu INSS) — colunas e
// cabeçalhos exclusivos do documento. Só estes autorizam aceitar um documento que
// TAMBÉM traz marcas de histórico de crédito (evita falso-positivo/negativo).
const SINAIS_HISCON_FORTE: readonly string[] = [
  'hiscon',
  'historico de emprestimo consignado',
  'historico de emprestimos consignados',
  'extrato de emprestimos consignados',
  'extrato de consignacoes',
  'origem da averbacao',
  'competencia de desconto',
  'banco consignatario',
];

/** O documento é um HISTÓRICO DE CRÉDITO (não o HISCON)? true quando traz marcas
 *  de relatório de crédito E não traz um sinal FORTE de extrato de consignado. */
export function pareceHistoricoDeCredito(texto: string): boolean {
  const t = normalizar(texto);
  if (t === '') return false;
  const credito = SINAIS_HISTORICO_CREDITO.some((f) => t.includes(f));
  const hisconForte = SINAIS_HISCON_FORTE.some((f) => t.includes(f));
  return credito && !hisconForte;
}

// Sinais do CONTRATO DE EMPRÉSTIMO firmado com o BANCO (cédula de crédito
// bancário, proposta, termo de adesão) — caso 5521969515359 (2026-07-27): o
// cliente mandou o CONTRATO do consignado, que naturalmente cita "empréstimo
// consignado", e a AHRI o registrou como HISCON e declarou o cadastro completo.
// O contrato é papel do BANCO (cláusulas, assinatura, emitente); o HISCON é o
// extrato do INSS. Um sinal FORTE basta; os fracos exigem dois.
const SINAIS_CONTRATO_BANCARIO_FORTE: readonly string[] = [
  'cedula de credito bancario',
  'contrato de emprestimo',
  // Caso José Anderson (81 9793-5655, 2026-07-30): o arquivo se chamava
  // "contrato_emprestimo_consignado_300726.pdf" — SEM o "de" — e escapava do
  // sinal forte. Variantes reais de cabeçalho/nome de arquivo:
  'contrato emprestimo',
  'contrato consignado',
  'instrumento particular de emprestimo',
  'contrato de credito',
  'proposta de emprestimo',
  'proposta de credito',
  'termo de adesao',
];
const SINAIS_CONTRATO_BANCARIO_FRACO: readonly string[] = [
  'clausula',
  'contratante',
  'contratada',
  'emitente',
  'credor',
  'condicoes gerais',
  'autorizacao de desconto',
  'autorizo o desconto',
  'assinatura',
  'foro de eleicao',
];

/** O documento é o CONTRATO do empréstimo com o banco (não o extrato do INSS)?
 *  true com um sinal FORTE (ou dois fracos) E nenhum sinal forte de HISCON. */
export function pareceContratoBancario(texto: string): boolean {
  const t = normalizar(texto);
  if (t === '') return false;
  if (SINAIS_HISCON_FORTE.some((f) => t.includes(f))) return false;
  if (SINAIS_CONTRATO_BANCARIO_FORTE.some((f) => t.includes(f))) return true;
  return SINAIS_CONTRATO_BANCARIO_FRACO.filter((f) => t.includes(f)).length >= 2;
}

// Sinais de que a BUSCA não trouxe contratos (a tela de consulta ficou vazia).
// Um extrato vazio/"não encontrado" NUNCA é um extrato válido — mesmo que a tela
// cite "consignado" no título. (Cliente 7582422298, 2026-07-25.)
const SINAIS_HISCON_SEM_RESULTADO: readonly string[] = [
  'emprestimo nao encontrado',
  'emprestimos nao encontrados',
  'nenhum emprestimo encontrado',
  'nao foram encontrados emprestimos',
  'informe outras opcoes de filtro',
];
// Sinais da TELA DE CONSULTA/BUSCA (filtros) do Meu INSS — não é o extrato em si,
// é o formulário de pesquisa. Um print dela não traz os contratos.
const SINAIS_TELA_BUSCA_HISCON: readonly string[] = [
  'consultar historico',
  'situacao do emprestimo',
  'mes da contratacao',
  'ano da contratacao',
  'nova busca',
  'situacao do beneficio',
];

/** O que chegou é um PRINT DA TELA DE CONSULTA/BUSCA do consignado (não o extrato)?
 *  true quando a busca não trouxe resultado, OU quando há marcas do formulário de
 *  filtro sem as colunas do extrato real. Espelha pareceHistoricoDeCredito. */
export function pareceTelaDeConsultaConsignado(texto: string): boolean {
  const t = normalizar(texto);
  if (t === '') return false;
  // "empréstimo não encontrado" = busca vazia ⇒ nunca é o extrato (mesmo com título).
  if (SINAIS_HISCON_SEM_RESULTADO.some((f) => t.includes(f))) return true;
  // Ou a tela de FILTRO (2+ marcas) sem os sinais FORTES do extrato de verdade.
  const marcasBusca = SINAIS_TELA_BUSCA_HISCON.filter((f) => t.includes(f)).length;
  const hisconForte = SINAIS_HISCON_FORTE.some((f) => t.includes(f));
  return marcasBusca >= 2 && !hisconForte;
}

// ── HISCON SEM UTILIDADE (decreto 2026-07-27, caso Marcelo) ──────────────────
// O projeto revisa CONTRATOS de consignado. Um HISCON sem NENHUM contrato na
// janela de 5 anos (ativo, suspenso OU excluído — qualquer situação) não tem o
// que revisar: a AHRI o DESCARTA (não registra, não completa o cadastro) e
// explica ao cliente. O zero só é acreditado quando vem do LEITOR AUDITADO (a
// marca do HISCON zerado conferido) — um parse que falhou jamais vira "zero".
const MARCA_HISCON_ZERADO = 'NENHUM CONTRATO DE EMPRÉSTIMO CONSIGNADO REGISTRADO NO DOCUMENTO';

/** true ⇒ o HISCON é legível mas NÃO SERVE ao projeto: zero contratos (zerado
 *  auditado) ou todos os contratos fora da janela de 5 anos. */
export function hisconSemUtilidade(texto: string, agora: Date): boolean {
  const h = parseHisconDetalhado(texto);
  if (h.contratos.length === 0) {
    // Só o ZERO AUDITADO (leitor conferiu o quantitativo 0/0 do documento) é
    // descartável; texto que simplesmente não parseia segue o fluxo normal.
    return texto.includes(MARCA_HISCON_ZERADO);
  }
  return contratosDaJanela(h.contratos, agora).length === 0;
}

// ── REGRA DURA: IMAGEM NUNCA É HISCON (caso Gelciana, 2026-07-26) ────────────
// A cliente mandou a FOTO de uma tela de erro ("Benefício não encontrado") e a
// AHRI a aceitou como HISCON, declarando a etapa completa. O HISCON é SEMPRE um
// PDF baixado do Meu INSS — nenhuma foto/print, por mais que a transcrição
// mencione "consignado", pode virar HISCON. RG e comprovante seguem valendo
// como imagem (são fotos por natureza); a trava vale só para o CNIS.
const EXTENSOES_IMAGEM = /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/i;

/** O arquivo recebido é uma IMAGEM (foto/print)? Usa o mimeType quando existe
 *  (fonte confiável do WhatsApp) e cai na extensão do nome como reforço. */
export function ehImagem(fileName: string, mimeType?: string | null): boolean {
  if (mimeType != null && mimeType !== '') return mimeType.toLowerCase().startsWith('image/');
  return EXTENSOES_IMAGEM.test(fileName.trim());
}

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
export function classificarDocumentoInicial(
  fileName: string,
  texto: string,
  mimeType?: string | null,
): ClassificacaoInicial {
  const corpo = normalizar(`${fileName} ${texto}`);
  if (corpo === '') return 'OUTRO';
  const tokens = new Set(corpo.split(' '));
  const pontuadas = DOCUMENTOS_CONHECIDOS.map((codigo) => {
    const s = SINAIS[codigo];
    const pontos =
      s.frases.filter((f) => corpo.includes(f)).length +
      s.tokens.filter((t) => tokens.has(t)).length;
    return { codigo, pontos };
  });
  const max = Math.max(...pontuadas.map((p) => p.pontos));
  if (max === 0) return 'OUTRO';
  const vencedoras = pontuadas.filter((p) => p.pontos === max);
  const resultado =
    vencedoras.length === 1 ? (vencedoras[0] as { codigo: DocumentoInicial }).codigo : 'OUTRO';

  // O HISCON é DOCUMENTO JURÍDICO: exige evidência de consignado no CONTEÚDO —
  // não basta o NOME do arquivo (caso José, 2026-07-22: mandou o "Histórico de
  // Créditos"/benefício nomeado como hiscon; foi aceito e deu 0 contratos). Se o
  // texto transcrito não traz sinal de consignado, NÃO é o HISCON ⇒ OUTRO (o
  // funil pede o documento certo em vez de aceitar o errado em silêncio).
  if (resultado === 'CNIS') {
    // TRAVA ABSOLUTA (caso Gelciana, 2026-07-26): o HISCON é sempre um PDF do
    // Meu INSS. Uma FOTO/PRINT jamais é o extrato — nem quando a transcrição
    // menciona "consignado" (era o caso: print de "Benefício não encontrado"
    // com o texto de ajuda do app). Vale ANTES de qualquer leitura de conteúdo.
    if (ehImagem(fileName, mimeType)) return 'OUTRO';
    // Caso José Anderson (2026-07-30): o CONTRATO chegou com a transcrição
    // ainda VAZIA e foi aceito como HISCON só pelo NOME do arquivo
    // ("contrato_emprestimo_consignado_300726.pdf") — nenhum guarda rodava.
    // O guarda do contrato agora lê NOME + texto (o próprio banco declara o
    // que o arquivo é); com texto presente e sinal FORTE de HISCON, ele
    // continua se recusando a vetar (a proteção interna já garante).
    if (pareceContratoBancario(`${fileName} ${texto}`)) return 'OUTRO';
    const soTexto = normalizar(texto);
    if (soTexto !== '') {
      // Caso 7582422298 (2026-07-25): PRINT da tela de consulta/busca do consignado
      // ("Empréstimo não encontrado") — cita "consignado" mas não traz contratos.
      if (pareceTelaDeConsultaConsignado(texto)) return 'OUTRO';
      // Caso Maria José (2026-07-24): HISTÓRICO DE CRÉDITO (SCR/Registrato) cita
      // "consignado" e era aceito como HISCON. Se tem cara de relatório de crédito
      // e não tem sinal FORTE de extrato do INSS ⇒ NÃO é o HISCON.
      if (pareceHistoricoDeCredito(texto)) return 'OUTRO';
      // Caso 5521969515359 (2026-07-27): o CONTRATO do empréstimo com o banco
      // cita "empréstimo consignado" e virava HISCON ("cadastro completo").
      if (pareceContratoBancario(texto)) return 'OUTRO';
      // Caso José: sem QUALQUER sinal de consignado ⇒ documento errado.
      if (!SINAIS.CNIS.frases.some((f) => soTexto.includes(f))) return 'OUTRO';
    }
    // Texto vazio = transcrição ainda não pronta ⇒ segue o fluxo (re-roda depois).
  }
  return resultado;
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
  /** Por que ficou OUTRO — permite a mensagem CERTA (ex.: histórico de crédito ou
   *  print da tela de consulta em vez do HISCON). null/ausente ⇒ genérico. */
  readonly motivoOutro?:
    | 'historico-credito'
    | 'tela-consulta-hiscon'
    | 'imagem-nao-e-hiscon'
    | 'contrato-bancario'
    | 'hiscon-sem-contratos'
    | null;
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
    /** mimeType do WhatsApp (image/jpeg, application/pdf…) — fonte confiável da
     *  trava "imagem nunca é HISCON". Ausente ⇒ cai na extensão do nome. */
    mimeType?: string | null,
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
    const classificacao = classificarDocumentoInicial(fileName, texto ?? '', mimeType);
    // Decreto 2026-07-27 (caso Marcelo): HISCON legível mas SEM contratos na
    // janela de 5 anos não serve ao projeto — DESCARTA (não registra, não
    // completa o cadastro) e a AHRI explica. O zero só é acreditado quando o
    // leitor AUDITOU o quantitativo 0/0 do próprio documento.
    if (classificacao === 'CNIS' && texto !== null && hisconSemUtilidade(texto, now)) {
      return {
        classificacao: 'OUTRO',
        jaRecebido: false,
        faltando: faltando(atual),
        classificacaoPendente: false,
        progresso: null,
        textoExcerto: texto.slice(0, 200),
        motivoOutro: 'hiscon-sem-contratos',
      };
    }
    if (classificacao === 'OUTRO') {
      // A pessoa mandou uma FOTO/PRINT tentando entregar o HISCON? (o texto fala
      // de consignado, mas o arquivo é imagem) ⇒ motivo próprio, mensagem firme.
      const fotoTentandoSerHiscon =
        ehImagem(fileName, mimeType) &&
        SINAIS.CNIS.frases.some((f) => normalizar(texto ?? '').includes(f));
      // Sem texto legível AINDA (o vínculo de mídia é assíncrono) ⇒ vale retentar.
      return {
        classificacao,
        jaRecebido: false,
        faltando: faltando(atual),
        classificacaoPendente: texto === null,
        progresso: null,
        textoExcerto: texto === null ? null : texto.slice(0, 200),
        // Ordem = do diagnóstico MAIS específico para o mais geral: saber que a
        // busca voltou vazia ajuda mais do que saber que é uma foto.
        motivoOutro: pareceTelaDeConsultaConsignado(texto ?? '')
          ? 'tela-consulta-hiscon'
          : pareceHistoricoDeCredito(texto ?? '')
            ? 'historico-credito'
            : pareceContratoBancario(texto ?? '')
              ? 'contrato-bancario'
              : fotoTentandoSerHiscon
                ? 'imagem-nao-e-hiscon'
                : null,
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
