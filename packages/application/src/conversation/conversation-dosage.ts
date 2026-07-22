// ─────────────────────────────────────────────────────────────────────────────
// CAMADA DE CONVERSAÇÃO (GO-LIVE 9D) — controla QUANTO entra em cada turno:
// quantidade de informação, naturalidade, progressividade e iniciativa.
//
// Princípio único: "A MENOR RESPOSTA VERDADEIRA" — responder somente ao que a
// pessoa disse; nunca antecipar o que ainda não foi perguntado.
//
// NÃO altera fatos, NÃO decide (o Brain decidiu; a Truth Layer é a verdade).
// Ela apenas DOSA o contexto que alimenta o fraseado deste turno:
//  • turno SOCIAL (saudação/smalltalk/greet): NENHUM fato de caso entra — a
//    resposta é um cumprimento e a pergunta de como ajudar. Nada mais.
//  • demais turnos: os fatos entram (podem ser necessários para responder), sob
//    o mesmo princípio de progressividade.
// A conversa evolui junto com o usuário — pergunta a pergunta.
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationIntent } from './intent.js';
import type { ConversationContextView } from './ports.js';

export interface DoseDaConversa {
  /** Fatos do caso dosados para ESTE turno (null = não entram no fraseado). */
  readonly casoFatos: string | null;
  /** O princípio de conduta do turno (curto — substitui verbosidade, não soma). */
  readonly principio: string;
}

/** O turno é social? (cumprimento/conversa leve — não pede informação nenhuma) */
export function turnoSocial(intent: ConversationIntent, context: ConversationContextView): boolean {
  const purpose = context.lastPercept?.enrichment?.perceivedPurpose ?? 'unknown';
  return purpose === 'greeting' || purpose === 'smalltalk' || intent.speechAct === 'greet';
}

/** Decide quanto contexto entra neste turno. Determinístico; nunca altera fatos. */
export function doseConversa(
  intent: ConversationIntent,
  context: ConversationContextView,
): DoseDaConversa {
  if (turnoSocial(intent, context)) {
    return {
      casoFatos: null,
      principio:
        'apenas retribua o cumprimento com calor humano e pergunte como pode ajudar — nada mais',
    };
  }
  return {
    casoFatos: context.casoFatos ?? null,
    principio:
      'a MENOR resposta verdadeira: responda somente ao que a pessoa pediu; nunca antecipe informações não perguntadas',
  };
}
