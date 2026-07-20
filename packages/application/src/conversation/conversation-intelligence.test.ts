// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION INTELLIGENCE (GO-LIVE 9E) — testes da condução por curiosidade:
// modo do turno pelo propósito (genérico, sem domínio), disciplina de UMA
// pergunta, anti-redundância mecânica (perguntas já feitas) e a proibição de
// perguntar o que os fatos já respondem. A camada nunca decide nem altera fatos.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ConversationIntent } from './intent.js';
import type { ConversationContextView } from './ports.js';
import type { PerceivedPurpose } from './percept.js';
import { conduzirTurno, perguntasFeitas } from './conversation-intelligence.js';
import { PromptBuilderRuntime } from './prompt-builder-runtime.js';

const FATOS = 'FATOS: situação X; próximo passo Y.';

function intent(over: Partial<ConversationIntent> = {}): ConversationIntent {
  return {
    id: 'i1', chatId: 'c1', directive: 'speak', speechAct: 'explain', topic: 'relacionamento',
    references: [], urgency: 'normal', operationalRuleRef: 'RO-X', fundamento: 'f',
    timingHintMs: null, formedAt: new Date('2026-07-19T12:00:00.000Z'),
    ...over,
  };
}

function contexto(purpose: PerceivedPurpose, outbounds: string[] = [], casoFatos: string | null = FATOS): ConversationContextView {
  return {
    session: { chatId: 'c1', turns: 3, lastInboundAt: null, lastOutboundAt: null },
    lastPercept: { enrichment: { perceivedPurpose: purpose } } as never,
    recentOutboundTexts: outbounds,
    casoFatos,
    // 15A: a condução por curiosidade (9E) é comportamento PÓS-conversão.
    missaoDaConversa: 'CLIENTE',
  } as unknown as ConversationContextView;
}

describe('conduzirTurno · o próximo passo da conversa (genérico)', () => {
  it('SOCIAL: a única curiosidade é "como posso ajudar" — nada mais', () => {
    const c = conduzirTurno(intent({ speechAct: 'greet' }), contexto('greeting'));
    expect(c.modo).toBe('social');
    expect(c.casoFatos).toBeNull(); // herda a dosagem 9D
    expect(c.conduta).toContain('pergunte como pode ajudar — nada mais');
  });

  it('DESCOBERTA (a pessoa trouxe algo): acolher + UMA curiosidade + esperar', () => {
    const c = conduzirTurno(intent(), contexto('service_request'));
    expect(c.modo).toBe('descoberta');
    expect(c.conduta).toContain('UMA única curiosidade');
    expect(c.conduta).toContain('NUNCA faça duas perguntas');
    expect(c.conduta).toContain('nunca vire entrevista');
    expect(c.conduta).toContain('nunca antecipe explicações sobre empresa, serviços ou etapas');
  });

  it('INFORMATIVO (pergunta): responder é o centro; nunca perguntar o que os fatos respondem', () => {
    const c = conduzirTurno(intent(), contexto('question'));
    expect(c.modo).toBe('informativo');
    expect(c.conduta).toContain('MENOR resposta verdadeira');
    expect(c.conduta).toContain('não pergunte nada que os FATOS fornecidos já respondem');
    expect(c.conduta).toContain('NO MÁXIMO UMA pergunta');
  });

  it('propósito unknown (degrade) não vira interrogatório: cai em descoberta disciplinada', () => {
    expect(conduzirTurno(intent(), contexto('unknown')).modo).toBe('descoberta');
  });
});

describe('anti-redundância · nunca repetir pergunta já feita', () => {
  it('perguntasFeitas extrai mecanicamente as perguntas dos outbounds', () => {
    const feitas = perguntasFeitas([
      'Sinto muito por isso. Você perdeu esse dinheiro em apostas?',
      'Entendi! Isso aconteceu recentemente ou faz mais tempo?',
      'Certo, estou aqui.',
    ]);
    expect(feitas).toEqual([
      'Você perdeu esse dinheiro em apostas?',
      'Isso aconteceu recentemente ou faz mais tempo?',
    ]);
  });

  it('as perguntas já feitas entram nas frases PROIBIDAS do fraseado (avoidPhrases)', () => {
    const builder = new PromptBuilderRuntime(8);
    const req = builder.build(
      intent(),
      contexto('service_request', ['Sinto muito. Você perdeu esse dinheiro em apostas?']),
    );
    expect(req.avoidPhrases).toContain('Você perdeu esse dinheiro em apostas?');
    expect(req.styleGuidance).toContain('repita pergunta já feita');
  });
});
