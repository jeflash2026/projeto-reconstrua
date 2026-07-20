// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MISSION POLICY (GO-LIVE 15A) — a conversa é guiada por um ESTADO
// EXPLÍCITO da missão, não por um booleano. A cada estado corresponde uma
// prioridade; a política molda a CONDUTA do turno conforme o estado.
//
//   LEAD           → prioridade ABSOLUTA: conversão + coleta documental.
//   EM_ANALISE     → prioridade: coleta documental e conclusão do dossiê.
//   CLIENTE        → conversa livre permitida, sem perder a missão do caso.
//   POS_ATENDIMENTO→ suporte e acompanhamento.
//
// View-model PURO (como a dosagem 9D / intelligence 9E): não decide nem altera
// fatos. O estado vem do DOMÍNIO (Truth Layer) via `context.missaoDaConversa` —
// nunca inferido da conversa. Ausente ⇒ LEAD (todo novo contato é um lead).
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationContextView, MissaoDaConversa } from './ports.js';

export type { MissaoDaConversa };

/** Todo novo contato, sem sinal de domínio, é um LEAD. */
export const MISSAO_PADRAO: MissaoDaConversa = 'LEAD';

const ESTADOS_VALIDOS: ReadonlySet<string> = new Set(['LEAD', 'EM_ANALISE', 'CLIENTE', 'POS_ATENDIMENTO']);
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
  EM_ANALISE: 'Completar Documentação',
  CLIENTE: 'Acompanhar Processo',
  POS_ATENDIMENTO: 'Suporte',
};

// ── Derivação do estado a partir da MISSÃO ATIVA (Mission Runtime) ─────────────
// A missão ativa é a FONTE PRIMÁRIA; o status do cliente é apenas UM dos sinais.
export interface SinaisDaMissao {
  readonly missaoAtiva: boolean; // há missão ATIVA no Mission Runtime (primário)
  readonly processoEncerrado: boolean; // estado terminal da missão (ENCERRADA)
  readonly vendaRegistrada: boolean; // sinal do STATUS do cliente (VENDIDO)
}

/** Deriva o estado a partir da missão ativa. Pura; o provider a usa. */
export function derivarMissaoDaConversa(s: SinaisDaMissao): MissaoDaConversa {
  if (!s.missaoAtiva) return 'LEAD'; // sem missão ativa ⇒ converter o lead
  if (s.processoEncerrado) return 'POS_ATENDIMENTO'; // missão encerrada ⇒ suporte
  if (s.vendaRegistrada) return 'CLIENTE'; // vendido ⇒ acompanhar o processo
  return 'EM_ANALISE'; // missão ativa, ainda não vendida ⇒ completar documentação
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

const CONDUTA_ANALISE =
  // GO-LIVE 15C — WORKFLOW 1 (documentação OBRIGATÓRIA, 100% dos clientes).
  'ESTADO: EM_ANALISE. O HISCON já foi recebido e lido pelo Reader. A documentação OBRIGATÓRIA do Projeto Reconstrua são apenas TRÊS: HISCON, RG ou CNH, e comprovante de endereço. ' +
  'Solicite SOMENTE os que ainda faltam entre RG/CNH e comprovante de endereço; nunca peça um documento que o cliente já enviou. Quando os três estiverem completos, a documentação inicial está CONCLUÍDA. ' +
  // É PROIBIDO qualquer outro documento nesta fase — contratos/procuração/etc. são do Workflow 2 (só o advogado solicita).
  'É PROIBIDO solicitar QUALQUER outro documento nesta fase: NUNCA peça contratos, procuração, extratos, comprovantes bancários ou documentos judiciais — esses só o ADVOGADO solicita, pelo painel. ' +
  'Responda IMEDIATAMENTE qualquer dúvida; NÃO faça perguntas que não avancem a documentação obrigatória';

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
  const podeResponderElegibilidade = missao === 'LEAD' || missao === 'EM_ANALISE';
  const respostaCanonica = podeResponderElegibilidade && perguntaDireta && ehPerguntaDeDireito(context) ? RESPOSTA_ELEGIBILIDADE : null;

  switch (missao) {
    case 'LEAD':
      return { missao, objetivo, substituiCuriosidade: true, perguntaDireta, respostaCanonica, conduta: CONDUTA_LEAD, reforco: '' };
    case 'EM_ANALISE':
      return { missao, objetivo, substituiCuriosidade: true, perguntaDireta, respostaCanonica, conduta: CONDUTA_ANALISE, reforco: '' };
    case 'CLIENTE':
      return { missao, objetivo, substituiCuriosidade: false, perguntaDireta, respostaCanonica: null, conduta: '', reforco: REFORCO_CLIENTE };
    case 'POS_ATENDIMENTO':
      return { missao, objetivo, substituiCuriosidade: false, perguntaDireta, respostaCanonica: null, conduta: '', reforco: REFORCO_POS };
  }
}

/** styleGuidance da missão quando a conduta SUBSTITUI a curiosidade (LEAD/EM_ANALISE). */
export function styleGuidanceDaMissao(politica: PoliticaDaMissao): string {
  if (!politica.substituiCuriosidade) return '';
  const canon = politica.respostaCanonica
    ? `. Para a pergunta de DIREITO/elegibilidade, responda EXATAMENTE assim, sem rodeios: "${politica.respostaCanonica}"`
    : '';
  return `${politica.conduta}${canon}`;
}
