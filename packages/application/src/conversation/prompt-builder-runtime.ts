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
  if (context.session.turns <= 1) parts.push('como um primeiro contato humano, não robótico');
  else parts.push('como quem já acompanha a pessoa e lembra do histórico');

  if (intent.urgency === 'high') parts.push('com senso de urgência sem alarmar');

  return parts.join('; ');
}

export class PromptBuilderRuntime {
  constructor(private readonly antiRepetitionWindow: number) {}

  build(intent: ConversationIntent, context: ConversationContextView): PhrasingRequest {
    const avoidPhrases = context.recentOutboundTexts.slice(0, this.antiRepetitionWindow);
    return {
      intent,
      context,
      avoidPhrases,
      styleGuidance: toneFor(intent, context),
    };
  }
}
