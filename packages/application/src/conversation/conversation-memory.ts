// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONAL MEMORY (GO-LIVE 9F) — a memória da CONVERSA ATIVA.
//
// NÃO persistente por construção: é 100% DERIVADA do diálogo corrente
// (recentEntries do contexto) a cada turno — nasce e morre com a conversa,
// nunca é gravada, nunca vaza entre conversas ou produtos.
//
// GENÉRICA: não conhece Direito, nem AHRI Business, nem Life. Conhece apenas
// continuidade de conversa: o que já foi perguntado, o que já foi respondido,
// qual a última resposta, qual o objetivo do turno e qual a hipótese percebida.
//
// Mecânica pura (sem LLM): uma pergunta feita num outbound está RESPONDIDA se
// existe QUALQUER inbound posterior a ela; caso contrário está ABERTA. A
// resposta anterior é o inbound corrente. O "fio" é o par pergunta→resposta —
// o solo de onde a PRÓXIMA curiosidade deve nascer (Expression frasea; a
// disciplina vem da Conversation Intelligence 9E).
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationIntent } from './intent.js';
import type { ConversationContextView, MemoryEntry } from './ports.js';

export interface MemoriaDaConversa {
  /** A última curiosidade que a AHRI fez (pergunta mais recente). */
  readonly ultimaCuriosidade: string | null;
  /** A última resposta recebida (o inbound corrente/mais recente). */
  readonly ultimaResposta: string | null;
  /** Objetivo atual do turno — a intenção decidida pelo Planner. */
  readonly objetivoAtual: string | null;
  /** Hipótese atual — o sinal de intenção PERCEBIDO (percepção, não decisão). */
  readonly hipoteseAtual: string | null;
  /** Perguntas já RESPONDIDAS (assunto encerrado — jamais reabrir). */
  readonly perguntasRespondidas: readonly string[];
  /** Perguntas feitas AINDA sem resposta (as lacunas abertas do diálogo). */
  readonly perguntasAbertas: readonly string[];
  /** O fio: "perguntei X → a pessoa respondeu Y" — de onde o turno continua. */
  readonly fioDaConversa: string | null;
}

function perguntasDe(texto: string | null): string[] {
  if (texto === null || texto === '') return [];
  return texto
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.endsWith('?'));
}

function curto(s: string, max = 110): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Deriva a memória ativa do diálogo corrente. Determinística; nunca grava nada. */
export function memoriaDaConversa(
  intent: ConversationIntent,
  context: ConversationContextView,
): MemoriaDaConversa {
  // Derivada e RESILIENTE: contexto parcial (sem entries) ⇒ memória vazia —
  // a camada jamais derruba um turno; apenas deixa de ter fio.
  const entries: readonly MemoryEntry[] = [...(context.recentEntries ?? [])].sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  );

  const respondidas: string[] = [];
  const abertas: string[] = [];
  let ultimaCuriosidade: string | null = null;
  let ultimoInbound: string | null = null;

  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    if (e === undefined) continue;
    if (e.kind === 'outbound') {
      const qs = perguntasDe(e.text);
      if (qs.length === 0) continue;
      ultimaCuriosidade = qs[qs.length - 1] ?? ultimaCuriosidade;
      const respondida = entries.slice(i + 1).some((n) => n.kind === 'inbound');
      for (const q of qs) (respondida ? respondidas : abertas).push(q);
    } else if (e.kind === 'inbound' && e.text !== null && e.text !== '') {
      ultimoInbound = e.text;
    }
  }

  // A resposta corrente: o percept do turno (fonte primária) ou o último inbound do log.
  const ultimaResposta = context.lastPercept?.envelope?.text ?? ultimoInbound;

  // O fio só existe quando houve pergunta E a pessoa respondeu depois dela.
  const fioDaConversa =
    ultimaCuriosidade !== null && ultimaResposta !== null && respondidas.includes(ultimaCuriosidade)
      ? `você perguntou: «${curto(ultimaCuriosidade)}» e a pessoa respondeu: «${curto(ultimaResposta)}» — continue exatamente daqui`
      : null;

  return {
    ultimaCuriosidade,
    ultimaResposta,
    objetivoAtual: intent.topic,
    hipoteseAtual: context.lastPercept?.enrichment?.detectedIntentSignal ?? null,
    perguntasRespondidas: respondidas,
    perguntasAbertas: abertas,
    fioDaConversa,
  };
}
