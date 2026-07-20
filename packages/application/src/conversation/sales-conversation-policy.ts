// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MISSION POLICY (GO-LIVE 15A) — a conversa é guiada por um ESTADO
// EXPLÍCITO da missão, não por um booleano. A cada estado corresponde uma
// prioridade; a política molda a CONDUTA do turno conforme o estado.
//
//   LEAD                   → prioridade ABSOLUTA: conversão + HISCON first.
//   ONBOARDING_DOCUMENTAL  → Jornada 1: levar até 100% da documentação inicial
//                            FIXA (HISCON, RG/CNH, comprovante de endereço).
//   ANALISE_ADMINISTRATIVA → documentação 100%; análise em curso: conversa
//                            normal, andamento, sigilo; NUNCA pede documentos
//                            por iniciativa própria (só DocumentRequest ativo).
//   CLIENTE                → conversa livre permitida, sem perder a missão.
//   POS_ATENDIMENTO        → suporte e acompanhamento.
//
// View-model PURO (como a dosagem 9D / intelligence 9E): não decide nem altera
// fatos. O estado vem do DOMÍNIO (Truth Layer) via `context.missaoDaConversa` —
// nunca inferido da conversa. Ausente ⇒ LEAD (todo novo contato é um lead).
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationContextView, MissaoDaConversa } from './ports.js';

export type { MissaoDaConversa };

/** Todo novo contato, sem sinal de domínio, é um LEAD. */
export const MISSAO_PADRAO: MissaoDaConversa = 'LEAD';

const ESTADOS_VALIDOS: ReadonlySet<string> = new Set(['LEAD', 'ONBOARDING_DOCUMENTAL', 'ANALISE_ADMINISTRATIVA', 'CLIENTE', 'POS_ATENDIMENTO']);
/** Fallback SEGURO: só as 4 missões conhecidas passam; qualquer outra ⇒ LEAD. */
export function ehMissaoValida(v: unknown): v is MissaoDaConversa {
  return typeof v === 'string' && ESTADOS_VALIDOS.has(v);
}

/** Resposta CANÔNICA para a pergunta de elegibilidade ("tenho direito?"). */
export const RESPOSTA_ELEGIBILIDADE =
  'É possível, mas somente conseguimos afirmar após analisar gratuitamente o seu HISCON (histórico de empréstimos consignados do INSS).';

// ── Objetivo da missão por estado (a conversa SEMPRE segue a missão atual) ─────
export const OBJETIVO_DA_MISSAO: Readonly<Record<MissaoDaConversa, string>> = {
  LEAD: 'Converter Lead',
  ONBOARDING_DOCUMENTAL: 'Completar a Documentação Inicial',
  ANALISE_ADMINISTRATIVA: 'Acompanhar a Análise Administrativa',
  CLIENTE: 'Acompanhar Processo',
  POS_ATENDIMENTO: 'Suporte',
};

// ── Derivação do estado a partir da MISSÃO ATIVA (Mission Runtime) ─────────────
// A missão ativa é a FONTE PRIMÁRIA; o status do cliente é apenas UM dos sinais.
export interface SinaisDaMissao {
  readonly missaoAtiva: boolean; // há missão ATIVA no Mission Runtime (primário)
  readonly processoEncerrado: boolean; // estado terminal da missão (ENCERRADA)
  readonly vendaRegistrada: boolean; // sinal do STATUS do cliente (VENDIDO)
  /** Decreto "Jornada Documental Inicial": os 3 obrigatórios estão 100%?
   *  (contabilidade canônica da Jornada 1 — nunca inferido da conversa) */
  readonly documentacaoInicialCompleta: boolean;
}

/** Deriva o estado a partir da missão ativa. Pura; o provider a usa. */
export function derivarMissaoDaConversa(s: SinaisDaMissao): MissaoDaConversa {
  if (!s.missaoAtiva) return 'LEAD'; // sem missão ativa ⇒ converter o lead
  if (s.processoEncerrado) return 'POS_ATENDIMENTO'; // missão encerrada ⇒ suporte
  if (s.vendaRegistrada) return 'CLIENTE'; // vendido ⇒ acompanhar o processo
  // Jornada 1: enquanto QUALQUER obrigatório estiver pendente ⇒ onboarding;
  // com 100% ⇒ análise administrativa (a mudança é AUTOMÁTICA — decreto).
  return s.documentacaoInicialCompleta ? 'ANALISE_ADMINISTRATIVA' : 'ONBOARDING_DOCUMENTAL';
}

export interface PoliticaDaMissao {
  readonly missao: MissaoDaConversa;
  /** O OBJETIVO da missão atual — a conversa sempre o segue. */
  readonly objetivo: string;
  /** true ⇒ a conduta da missão SUBSTITUI a curiosidade (9E). (LEAD, EM_ANALISE) */
  readonly substituiCuriosidade: boolean;
  /** O cliente fez uma pergunta direta que deve ser respondida ANTES de tudo. */
  readonly perguntaDireta: boolean;
  /** Resposta exata para a pergunta de direito/elegibilidade (LEAD/EM_ANALISE). */
  readonly respostaCanonica: string | null;
  /** Conduta da missão, usada quando `substituiCuriosidade`. */
  readonly conduta: string;
  /** Reforço leve, ANEXADO à conduta 9E quando NÃO substitui (CLIENTE, POS). */
  readonly reforco: string;
}

function textoDoTurno(context: ConversationContextView): string {
  return (context.lastPercept?.envelope?.text ?? '').toLowerCase();
}
function ehPerguntaDireta(context: ConversationContextView): boolean {
  const purpose = context.lastPercept?.enrichment?.perceivedPurpose ?? 'unknown';
  return purpose === 'question' || textoDoTurno(context).includes('?');
}
function ehPerguntaDeDireito(context: ConversationContextView): boolean {
  return /\bdireito\b|\bdireitos\b|me\s+enquadr|tenho\s+como|eleg[íi]v|fa[çc]o\s+jus/.test(textoDoTurno(context));
}

// Condutas por estado (autoradas; prioridade sobre a curiosidade quando aplicável).
const CONDUTA_LEAD =
  'ESTADO: LEAD. Você é a melhor CONSULTORA COMERCIAL de consignado do Brasil e, enquanto o cliente ainda NÃO contratou, sua ÚNICA missão é convertê-lo — não conversar. ' +
  'Responda IMEDIATAMENTE e por completo qualquer pergunta do cliente ANTES de qualquer outra coisa; ' +
  'NUNCA devolva uma pergunta antes de responder a dúvida. ' +
  'Explique o serviço com clareza em MENOS DE 80 PALAVRAS. ' +
  // GO-LIVE 15B — HISCON FIRST: peça SÓ o HISCON na primeira interação; contratos só depois de lê-lo.
  'Logo após responder, conduza IMEDIATAMENTE para solicitar APENAS o HISCON (histórico de empréstimos consignados) — a fonte primária da análise, sem custo. ' +
  'É PROIBIDO pedir contratos ou qualquer outro documento antes de ler o HISCON. Nunca peça vários documentos de uma vez. ' +
  'ELIMINE perguntas de curiosidade que não alteram a elegibilidade. ' +
  'A conversa deve SEMPRE convergir para a conversão e a coleta dos documentos. ' +
  'Otimize exclusivamente: confiança, clareza, velocidade, coleta documental e conversão';

/** A pessoa enviou um ARQUIVO nesta mensagem? (fato do envelope — nunca inferido) */
function enviouArquivoNesteTurno(context: ConversationContextView): boolean {
  const e = context.lastPercept?.envelope;
  return e != null && (e.fileName != null || e.mediaUrl != null);
}

/** Jornada 1 — conduta DINÂMICA: nasce da contabilidade real (o que chegou/falta). */
function condutaOnboarding(context: ConversationContextView): string {
  const ob = context.onboardingDocumental;
  const situacao =
    ob !== null && ob !== undefined
      ? `${ob.recebidos.length > 0 ? `Já recebidos e CONFIRMADOS: ${ob.recebidos.join('; ')}. ` : ''}` +
        `Ainda faltam: ${ob.faltando.length > 0 ? ob.faltando.join('; ') : 'nenhum'}. ` +
        `${ob.proximo !== null ? `Solicite AGORA, nesta resposta, APENAS o próximo: ${ob.proximo}. ` : ''}`
      : 'A contabilidade ainda não registrou nenhum recebimento: comece pelo HISCON (histórico de empréstimos consignados). ';
  // Correção GO-LIVE: quando o arquivo chega NESTE turno mas o registro ainda
  // está em processamento (transcrição assíncrona), a AHRI jamais pode responder
  // ao envio pedindo o MESMO documento — agradece, confirma o recebimento e segue.
  const arquivoAgora = enviouArquivoNesteTurno(context)
    ? 'ATENÇÃO — a pessoa ACABOU de enviar um arquivo NESTA mensagem: agradeça e confirme o recebimento com naturalidade. ' +
      'Se a lista acima ainda não refletir esse arquivo (registro em processamento), NÃO peça novamente o documento que ela acabou de mandar — ' +
      'diga que já está registrando e, se ainda faltar OUTRO documento diferente, mencione apenas esse outro. '
    : '';
  return (
    'ESTADO: ONBOARDING_DOCUMENTAL (Jornada 1). Sua missão é levar o cliente até 100% da documentação inicial FIXA — ' +
    'exatamente TRÊS documentos, nesta ordem: HISCON, RG ou CNH, e comprovante de endereço. ' +
    situacao +
    arquivoAgora +
    'Confirme com naturalidade cada documento que o cliente enviar e peça IMEDIATAMENTE o próximo que falta — um por vez, nunca vários. ' +
    'NUNCA diga que vai analisar o caso agora, NUNCA encerre o atendimento e NUNCA deixe o cliente aguardando: enquanto faltar documento, a conversa continua. ' +
    'É PROIBIDO solicitar QUALQUER outro documento nesta fase: NUNCA peça contratos, procuração, extratos, comprovantes bancários ou documentos judiciais — complementares só nascem do Painel do Advogado (Jornada 2). ' +
    'Responda IMEDIATAMENTE qualquer dúvida; NÃO faça perguntas que não avancem a documentação obrigatória'
  );
}

const REFORCO_ANALISE_ADMINISTRATIVA =
  'ESTADO: ANALISE_ADMINISTRATIVA — a documentação inicial está 100% completa e o cadastro está em análise administrativa. ' +
  'Responda dúvidas, converse normalmente e informe o andamento do caso quando perguntarem. ' +
  'Preserve o sigilo da empresa, NUNCA revele dados de terceiros e NUNCA invente prazos. ' +
  'NUNCA solicite documentos por iniciativa própria: documento complementar só é pedido quando existir uma solicitação ATIVA do advogado (ela aparece como MISSÃO OPERACIONAL); sem ela, nenhum pedido de documento';

const REFORCO_CLIENTE =
  'ESTADO: CLIENTE — responda diretamente a dúvida antes de tudo; a conversa livre é permitida, mas nunca perca a missão do caso';

const REFORCO_POS =
  'ESTADO: POS_ATENDIMENTO — modo suporte e acompanhamento: acolha, responda com clareza e ofereça o próximo acompanhamento quando fizer sentido';

/** Avalia a política do turno pelo ESTADO da missão. Determinística. */
export function politicaDaMissao(context: ConversationContextView): PoliticaDaMissao {
  // Item 15A-review Q4: estado ausente, desconhecido OU inválido ⇒ LEAD (seguro).
  const missao: MissaoDaConversa = ehMissaoValida(context.missaoDaConversa) ? context.missaoDaConversa : MISSAO_PADRAO;
  const objetivo = OBJETIVO_DA_MISSAO[missao];
  const perguntaDireta = ehPerguntaDireta(context);
  const podeResponderElegibilidade = missao === 'LEAD' || missao === 'ONBOARDING_DOCUMENTAL';
  const respostaCanonica = podeResponderElegibilidade && perguntaDireta && ehPerguntaDeDireito(context) ? RESPOSTA_ELEGIBILIDADE : null;

  switch (missao) {
    case 'LEAD':
      return { missao, objetivo, substituiCuriosidade: true, perguntaDireta, respostaCanonica, conduta: CONDUTA_LEAD, reforco: '' };
    case 'ONBOARDING_DOCUMENTAL':
      return { missao, objetivo, substituiCuriosidade: true, perguntaDireta, respostaCanonica, conduta: condutaOnboarding(context), reforco: '' };
    case 'ANALISE_ADMINISTRATIVA':
      return { missao, objetivo, substituiCuriosidade: false, perguntaDireta, respostaCanonica: null, conduta: '', reforco: REFORCO_ANALISE_ADMINISTRATIVA };
    case 'CLIENTE':
      return { missao, objetivo, substituiCuriosidade: false, perguntaDireta, respostaCanonica: null, conduta: '', reforco: REFORCO_CLIENTE };
    case 'POS_ATENDIMENTO':
      return { missao, objetivo, substituiCuriosidade: false, perguntaDireta, respostaCanonica: null, conduta: '', reforco: REFORCO_POS };
  }
}

/**
 * GO-LIVE 15C-3 — MISSÃO OPERACIONAL: "obter documento pendente". Deriva
 * EXCLUSIVAMENTE do contexto (que nasce do Mission Snapshot). Convive com a
 * conversa: responder normalmente e, ao final, lembrar GENTILMENTE — nunca
 * interromper, nunca soar robótico. Some sozinha quando o snapshot esvazia.
 */
export function condutaDePendencia(context: ConversationContextView): string {
  const p = context.pendenciaDocumental;
  if (p === null || p === undefined) return '';
  const urgencia = p.prioridade === 'alta' ? ' (é prioritário para o andamento)' : '';
  const outros = p.total > 1 ? ` — e há outros ${String(p.total - 1)} documento(s) pendente(s) além deste` : '';
  return (
    `; MISSÃO OPERACIONAL — obter documento pendente: ${p.requestedBy} aguarda a pessoa enviar «${p.documentName}»${urgencia}${outros}. ` +
    'Responda NORMALMENTE ao que a pessoa disse e, só ao final, lembre com GENTILEZA e leveza desse documento em UMA frase — ' +
    'jamais interrompa o assunto dela, jamais repita o lembrete de forma idêntica, jamais soe como roteiro ou cobrança fria'
  );
}

/** styleGuidance da missão quando a conduta SUBSTITUI a curiosidade (LEAD/EM_ANALISE). */
export function styleGuidanceDaMissao(politica: PoliticaDaMissao): string {
  if (!politica.substituiCuriosidade) return '';
  const canon = politica.respostaCanonica
    ? `. Para a pergunta de DIREITO/elegibilidade, responda EXATAMENTE assim, sem rodeios: "${politica.respostaCanonica}"`
    : '';
  return `${politica.conduta}${canon}`;
}
