// ─────────────────────────────────────────────────────────────────────────────
// CAMADA DE CONVERSAÇÃO (GO-LIVE 9D) — testes: "a menor resposta verdadeira".
// Turno social ⇒ NENHUM fato de caso entra no fraseado (mesmo cliente com caso);
// pergunta/pedido ⇒ os fatos entram; o princípio de progressividade viaja no
// styleGuidance. A camada nunca altera fatos — só dosa o que entra NESTE turno.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ConversationIntent } from './intent.js';
import type { ConversationContextView } from './ports.js';
import type { PerceivedPurpose } from './percept.js';
import { doseConversa, turnoSocial } from './conversation-dosage.js';
import { PromptBuilderRuntime } from './prompt-builder-runtime.js';

const FATOS = 'FATOS DO CASO: situação X; próximo passo Y; documentos Z.';

function intent(over: Partial<ConversationIntent> = {}): ConversationIntent {
  return {
    id: 'i1', chatId: 'c1', directive: 'speak', speechAct: 'explain', topic: 'relacionamento',
    references: [], urgency: 'normal', operationalRuleRef: 'RO-X', fundamento: 'f',
    timingHintMs: null, formedAt: new Date('2026-07-19T12:00:00.000Z'),
    ...over,
  };
}

function contexto(purpose: PerceivedPurpose | null, casoFatos: string | null = FATOS): ConversationContextView {
  return {
    session: { chatId: 'c1', turns: 3, lastInboundAt: null, lastOutboundAt: null },
    lastPercept: purpose === null ? null : ({ enrichment: { perceivedPurpose: purpose } } as never),
    recentOutboundTexts: [],
    casoFatos,
    // 15A: a conversa por curiosidade (9D/9E) é comportamento PÓS-conversão.
    missaoDaConversa: 'CLIENTE',
  } as unknown as ConversationContextView;
}

describe('doseConversa · progressividade (a menor resposta verdadeeira)', () => {
  it('SAUDAÇÃO: nenhum fato de caso entra — mesmo o cliente TENDO caso', () => {
    const d = doseConversa(intent(), contexto('greeting'));
    expect(d.casoFatos).toBeNull();
    expect(d.principio).toContain('retribua o cumprimento');
  });

  it('SMALLTALK: idem — conversa leve não recebe despejo de contexto', () => {
    expect(doseConversa(intent(), contexto('smalltalk')).casoFatos).toBeNull();
  });

  it('speechAct greet ⇒ social, mesmo com propósito unknown (degrade)', () => {
    expect(turnoSocial(intent({ speechAct: 'greet' }), contexto('unknown'))).toBe(true);
    expect(doseConversa(intent({ speechAct: 'greet' }), contexto('unknown')).casoFatos).toBeNull();
  });

  it('PERGUNTA/PEDIDO: os fatos entram (podem ser necessários para responder)', () => {
    expect(doseConversa(intent(), contexto('question')).casoFatos).toBe(FATOS);
    expect(doseConversa(intent(), contexto('service_request')).casoFatos).toBe(FATOS);
  });

  it('o princípio da progressividade viaja SEMPRE no turno não-social', () => {
    const d = doseConversa(intent(), contexto('question'));
    expect(d.principio).toContain('MENOR resposta verdadeira');
    expect(d.principio).toContain('nunca antecipe');
  });
});

describe('PromptBuilder · a dosagem chega ao fraseado', () => {
  const builder = new PromptBuilderRuntime(8);

  it('turno social: request SEM casoFatos + instrução mínima no styleGuidance', () => {
    const req = builder.build(intent({ speechAct: 'greet', topic: 'boas-vindas' }), contexto('greeting'));
    expect(req.context.casoFatos).toBeNull(); // o LLM nem VÊ os fatos
    expect(req.styleGuidance).toContain('retribua o cumprimento');
    expect(req.styleGuidance).toContain('nada mais');
  });

  it('turno de pergunta: request COM casoFatos + princípio da menor resposta', () => {
    const req = builder.build(intent(), contexto('question'));
    expect(req.context.casoFatos).toBe(FATOS);
    expect(req.styleGuidance).toContain('MENOR resposta verdadeira');
  });
});
