// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER RUNTIME — monta a REQUISIÇÃO de fraseado para o LLM de expressão.
//
// NÃO é template de saída. Monta o QUADRO (intenção + contexto + frases a evitar +
// diretriz de tom) para que o LLM produza linguagem NOVA e não repetida. A diretriz
// de estilo deriva do contexto (emoção, urgência, turno) — não de um script fixo.
// O prompt jamais autoriza o LLM a decidir fato/regra/estado.
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationIntent, SpeechAct } from './intent.js';
import type { ConversationContextView, PhrasingRequest } from './ports.js';
import { conduzirTurno } from './conversation-intelligence.js';
import { condutaDePendencia, politicaDaMissao, styleGuidanceDaMissao } from './sales-conversation-policy.js';

function toneFor(intent: ConversationIntent, context: ConversationContextView): string {
  const sentiment = context.lastPercept?.enrichment?.sentiment ?? 'unknown';
  const parts: string[] = [];

  // Registro base por ato de fala (guia, não roteiro).
  const act: SpeechAct | null = intent.speechAct;
  if (act === 'greet') parts.push('acolhedor e breve');
  else if (act === 'ask') parts.push('curioso e específico, uma pergunta por vez');
  else if (act === 'explain') parts.push('claro e paciente, sem jargão');
  else if (act === 'reassure') parts.push('sereno e presente');
  else if (act === 'request_document') parts.push('objetivo e gentil ao pedir');
  else if (act === 'deadline_warning') parts.push('firme e cuidadoso sobre o prazo');
  else if (act === 'follow_up') parts.push('leve, retomando o fio da conversa');
  else if (act === 'redirect') parts.push('fluido ao mudar de assunto');
  else parts.push('natural');

  // Ajuste pela emoção percebida.
  if (sentiment === 'anxious') parts.push('reduzindo a ansiedade da pessoa');
  else if (sentiment === 'confused') parts.push('desfazendo a confusão com simplicidade');
  else if (sentiment === 'negative') parts.push('empático, sem defensividade');

  // Turno inicial vs. relação já em curso.
  // GO-LIVE 9B: continuidade é da RELAÇÃO (conhecer a pessoa) — nunca implica
  // "acompanhar um caso"; falar de caso exige fatos (casoFatos/Truth Layer).
  if (context.session.turns <= 1) parts.push('como um primeiro contato humano, não robótico');
  else parts.push('como quem já conhece a pessoa e lembra das conversas anteriores');

  if (intent.urgency === 'high') parts.push('com senso de urgência sem alarmar');

  return parts.join('; ');
}

export class PromptBuilderRuntime {
  constructor(private readonly antiRepetitionWindow: number) {}

  build(intent: ConversationIntent, context: ConversationContextView): PhrasingRequest {
    // GO-LIVE 9E — CONVERSATION INTELLIGENCE (engloba a dosagem 9D): o próximo
    // passo da conversa — modo do turno, fatos dosados, UMA curiosidade no máximo,
    // e as perguntas já feitas entram nas frases a NUNCA repetir (anti-redundância).
    const conduta = conduzirTurno(intent, context);
    const avoidPhrases = [
      ...conduta.perguntasJaFeitas,
      ...context.recentOutboundTexts.slice(0, this.antiRepetitionWindow),
    ].slice(0, this.antiRepetitionWindow + conduta.perguntasJaFeitas.length);
    // GO-LIVE 15A — CONVERSATION MISSION POLICY (guiada pelo ESTADO da missão):
    // LEAD/ONBOARDING_DOCUMENTAL ⇒ a conduta da missão SUBSTITUI a curiosidade;
    // ANALISE_ADMINISTRATIVA/CLIENTE/POS ⇒ conversa livre (9E) + reforço leve.
    const politica = politicaDaMissao(context);
    const nucleo = politica.substituiCuriosidade
      ? styleGuidanceDaMissao(politica)
      : `${conduta.conduta}${politica.reforco ? `; ${politica.reforco}` : ''}`;
    // A conversa SEMPRE segue a missão atual (derivada da missão ativa do Runtime).
    // GO-LIVE 15C-3: a PENDÊNCIA documental (do snapshot) convive com qualquer
    // estado — a AHRI lembra gentilmente até received/cancelled esvaziarem.
    const condutaFinal = `MISSÃO ATUAL — ${politica.objetivo}: ${nucleo}${condutaDePendencia(context)}`;
    return {
      intent,
      // GO-LIVE 9F/9G: o FIO e o CONHECIMENTO da conversa ativa viajam no contexto —
      // a Expression continua de onde parou e jamais pergunta um fato já aprendido.
      context: {
        ...context,
        casoFatos: conduta.casoFatos,
        fioDaConversa: conduta.fioDaConversa,
        conhecimentoDaConversa: conduta.conhecimentoResumo,
      },
      avoidPhrases,
      styleGuidance: `${toneFor(intent, context)}; ${condutaFinal}`,
    };
  }
}
