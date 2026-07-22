// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONAL MEMORY (GO-LIVE 9F) — testes: a memória ATIVA é derivada do
// diálogo (nunca persistida) e mantém o fio por vários turnos: perguntas
// respondidas viram assunto encerrado (jamais repetidas), a próxima curiosidade
// nasce da ÚLTIMA resposta, e a conversa nunca volta ao começo.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ConversationIntent } from './intent.js';
import type { ConversationContextView, MemoryEntry } from './ports.js';
import { memoriaDaConversa } from './conversation-memory.js';
import { conduzirTurno } from './conversation-intelligence.js';
import { PromptBuilderRuntime } from './prompt-builder-runtime.js';

let seq = 0;
function entry(kind: MemoryEntry['kind'], text: string | null, minuto: number): MemoryEntry {
  seq += 1;
  return {
    id: `e${String(seq)}`,
    chatId: 'c1',
    kind,
    at: new Date(2026, 6, 19, 12, minuto),
    text,
    intentDirective: null,
    operationalRuleRef: null,
    meta: {},
  };
}

function intent(topic = 'relacionamento'): ConversationIntent {
  return {
    id: 'i1',
    chatId: 'c1',
    directive: 'speak',
    speechAct: 'explain',
    topic,
    references: [],
    urgency: 'normal',
    operationalRuleRef: 'RO-X',
    fundamento: 'f',
    timingHintMs: null,
    formedAt: new Date('2026-07-19T12:00:00.000Z'),
  };
}

function contexto(
  entries: MemoryEntry[],
  inboundAtual: string,
  sinal: string | null = null,
): ConversationContextView {
  return {
    chatId: 'c1',
    session: { chatId: 'c1', turns: entries.length, lastInboundAt: null, lastOutboundAt: null },
    recentEntries: entries,
    recentOutboundTexts: entries
      .filter((e) => e.kind === 'outbound' && e.text !== null)
      .map((e) => e.text ?? '')
      .reverse(),
    lastPercept: {
      envelope: { text: inboundAtual },
      enrichment: { perceivedPurpose: 'service_request', detectedIntentSignal: sinal },
    } as never,
    silenceMs: null,
    // 15A: a continuidade por curiosidade (9F) é comportamento PÓS-conversão.
    missaoDaConversa: 'CLIENTE',
  } as unknown as ConversationContextView;
}

// O diálogo dos exemplos do decreto (apostas), no meio do 3º turno:
function dialogoApostas(): MemoryEntry[] {
  return [
    entry('inbound', 'perdi muito dinheiro', 1),
    entry('outbound', 'Sinto muito. Foi em apostas ou em outra situação?', 2),
    entry('inbound', 'foi em apostas', 3),
    entry('outbound', 'Entendi. Isso aconteceu recentemente ou já faz algum tempo?', 4),
    entry('inbound', 'uns 3 anos', 5),
  ];
}

describe('memoriaDaConversa · derivada do diálogo ativo (nunca persistida)', () => {
  it('mantém última curiosidade, última resposta, respondidas e o FIO', () => {
    const m = memoriaDaConversa(intent(), contexto(dialogoApostas(), 'uns 3 anos'));
    expect(m.ultimaCuriosidade).toBe('Isso aconteceu recentemente ou já faz algum tempo?');
    expect(m.ultimaResposta).toBe('uns 3 anos');
    // As duas perguntas foram RESPONDIDAS — assunto encerrado, jamais reabrir:
    expect(m.perguntasRespondidas).toEqual([
      'Foi em apostas ou em outra situação?',
      'Isso aconteceu recentemente ou já faz algum tempo?',
    ]);
    expect(m.perguntasAbertas).toEqual([]);
    expect(m.fioDaConversa).toContain('Isso aconteceu recentemente');
    expect(m.fioDaConversa).toContain('uns 3 anos');
    expect(m.fioDaConversa).toContain('continue exatamente daqui');
  });

  it('pergunta AINDA sem resposta fica ABERTA (lacuna do diálogo)', () => {
    const entries = [
      entry('inbound', 'tenho consignado', 1),
      entry('outbound', 'O que está acontecendo com esse consignado?', 2),
    ];
    const m = memoriaDaConversa(intent(), contexto(entries, 'tenho consignado'));
    expect(m.perguntasAbertas).toEqual(['O que está acontecendo com esse consignado?']);
    expect(m.perguntasRespondidas).toEqual([]);
  });

  it('objetivo = intenção do Planner; hipótese = sinal PERCEBIDO (nunca decisão)', () => {
    const m = memoriaDaConversa(
      intent('acompanhamento do caso'),
      contexto(dialogoApostas(), 'uns 3 anos', 'parece relatar perda em apostas'),
    );
    expect(m.objetivoAtual).toBe('acompanhamento do caso');
    expect(m.hipoteseAtual).toBe('parece relatar perda em apostas');
  });
});

describe('continuidade multi-turno · a conversa nunca volta ao começo', () => {
  const builder = new PromptBuilderRuntime(8);

  it('turno 3 (apostas): perguntas anteriores PROIBIDAS + fio no contexto do fraseado', () => {
    const req = builder.build(intent(), contexto(dialogoApostas(), 'uns 3 anos'));
    // Jamais perguntar de novo sobre apostas nem sobre o tempo:
    expect(req.avoidPhrases).toContain('Foi em apostas ou em outra situação?');
    expect(req.avoidPhrases).toContain('Isso aconteceu recentemente ou já faz algum tempo?');
    // O fio viaja para a Expression — a resposta nasce da resposta anterior:
    expect(req.context.fioDaConversa).toContain('uns 3 anos');
    expect(req.styleGuidance).toContain('continue EXATAMENTE de onde a conversa parou');
    expect(req.styleGuidance).toContain('nunca reabra assunto já respondido');
    expect(req.styleGuidance).toContain('se nada falta descobrir');
  });

  it('consignado: após "o banco desconta errado", a pergunta do consignado está encerrada', () => {
    const entries = [
      entry('inbound', 'tenho consignado', 1),
      entry('outbound', 'Entendi. O que está acontecendo com esse consignado?', 2),
      entry('inbound', 'o banco desconta errado', 3),
    ];
    const conduta = conduzirTurno(intent(), contexto(entries, 'o banco desconta errado'));
    expect(conduta.perguntasJaFeitas).toContain('O que está acontecendo com esse consignado?');
    expect(conduta.fioDaConversa).toContain('o banco desconta errado');
  });

  it('sem pergunta anterior respondida ⇒ sem fio (primeiro contato não inventa passado)', () => {
    const m = memoriaDaConversa(
      intent(),
      contexto([entry('inbound', 'perdi muito dinheiro', 1)], 'perdi muito dinheiro'),
    );
    expect(m.fioDaConversa).toBeNull();
  });
});
