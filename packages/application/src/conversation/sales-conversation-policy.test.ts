// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MISSION POLICY (GO-LIVE 15A) — testes: a conversa é guiada por um
// ESTADO EXPLÍCITO da missão (LEAD/EM_ANALISE/CLIENTE/POS_ATENDIMENTO). LEAD e
// EM_ANALISE têm prioridade comercial (substituem a curiosidade 9E); CLIENTE e
// POS liberam a conversa livre com reforço leve. O estado é derivado do domínio,
// integrado ao ConversationContextView (default LEAD) e valida a política.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ConversationContextView, MissaoDaConversa } from './ports.js';
import type { ConversationIntent } from './intent.js';
import type { PerceivedPurpose } from './percept.js';
import {
  derivarMissaoDaConversa,
  politicaDaMissao,
  styleGuidanceDaMissao,
  RESPOSTA_ELEGIBILIDADE,
} from './sales-conversation-policy.js';
import { PromptBuilderRuntime } from './prompt-builder-runtime.js';
import { ConversationContextRuntime } from './conversation-context-runtime.js';
import type { SessionRuntime } from './session-runtime.js';
import type { ConversationMemoryRuntime } from './conversation-memory-runtime.js';

function intent(): ConversationIntent {
  return {
    id: 'i1', chatId: 'c1', directive: 'speak', speechAct: 'explain', topic: 'relacionamento',
    references: [], urgency: 'normal', operationalRuleRef: 'RO-X', fundamento: 'f',
    timingHintMs: null, formedAt: new Date('2026-07-19T12:00:00.000Z'),
  };
}
function contexto(over: { missao?: MissaoDaConversa; purpose?: PerceivedPurpose; texto?: string | null } = {}): ConversationContextView {
  return {
    chatId: 'c1',
    session: { chatId: 'c1', turns: 2, lastInboundAt: null, lastOutboundAt: null },
    recentEntries: [],
    recentOutboundTexts: [],
    lastPercept: { envelope: { text: over.texto ?? null }, enrichment: { perceivedPurpose: over.purpose ?? 'unknown', detectedIntentSignal: null } } as never,
    silenceMs: null,
    casoFatos: null,
    ...(over.missao !== undefined ? { missaoDaConversa: over.missao } : {}),
  } as unknown as ConversationContextView;
}

describe('15A · derivação a partir da MISSÃO ATIVA (primária) + status do cliente', () => {
  it('sem missão ativa ⇒ LEAD, mesmo com outros sinais', () => {
    expect(derivarMissaoDaConversa({ missaoAtiva: false, vendaRegistrada: false, processoEncerrado: false })).toBe('LEAD');
    expect(derivarMissaoDaConversa({ missaoAtiva: false, vendaRegistrada: true, processoEncerrado: true })).toBe('LEAD');
  });
  it('missão ativa ⇒ EM_ANALISE / CLIENTE / POS_ATENDIMENTO por prioridade', () => {
    expect(derivarMissaoDaConversa({ missaoAtiva: true, vendaRegistrada: false, processoEncerrado: false })).toBe('EM_ANALISE');
    expect(derivarMissaoDaConversa({ missaoAtiva: true, vendaRegistrada: true, processoEncerrado: false })).toBe('CLIENTE');
    expect(derivarMissaoDaConversa({ missaoAtiva: true, vendaRegistrada: true, processoEncerrado: true })).toBe('POS_ATENDIMENTO');
  });
  it('cada estado tem um OBJETIVO de missão', () => {
    expect(politicaDaMissao(contexto({ missao: 'LEAD' })).objetivo).toBe('Converter Lead');
    expect(politicaDaMissao(contexto({ missao: 'EM_ANALISE' })).objetivo).toBe('Completar Documentação');
    expect(politicaDaMissao(contexto({ missao: 'CLIENTE' })).objetivo).toBe('Acompanhar Processo');
    expect(politicaDaMissao(contexto({ missao: 'POS_ATENDIMENTO' })).objetivo).toBe('Suporte');
  });
});

describe('15A · a política por ESTADO da missão', () => {
  it('AUSENTE ⇒ LEAD (todo novo contato é lead)', () => {
    expect(politicaDaMissao(contexto({})).missao).toBe('LEAD');
  });

  it('Q4 — estado INVÁLIDO/desconhecido ⇒ fallback seguro para LEAD', () => {
    const ruim = { ...contexto({}), missaoDaConversa: 'ESTADO_INEXISTENTE' } as unknown as ConversationContextView;
    const p = politicaDaMissao(ruim);
    expect(p.missao).toBe('LEAD');
    expect(p.objetivo).toBe('Converter Lead');
    expect(p.substituiCuriosidade).toBe(true); // nunca undefined — nunca quebra o PromptBuilder
  });

  it('LEAD ⇒ conduta comercial substitui a curiosidade; converge p/ conversão + coleta', () => {
    const p = politicaDaMissao(contexto({ missao: 'LEAD' }));
    expect(p.substituiCuriosidade).toBe(true);
    expect(p.conduta).toContain('ÚNICA missão é convertê-lo');
    expect(p.conduta).toContain('Responda IMEDIATAMENTE');
    expect(p.conduta).toContain('NUNCA devolva uma pergunta antes de responder');
    expect(p.conduta).toContain('MENOS DE 80 PALAVRAS');
    // GO-LIVE 15B — HISCON FIRST: pede SÓ o HISCON e proíbe contratos antes.
    expect(p.conduta).toContain('solicitar APENAS o HISCON');
    expect(p.conduta).toContain('PROIBIDO pedir contratos');
    expect(p.conduta).not.toContain('HISCON e contratos'); // nunca pedir os dois juntos
    expect(p.conduta).toContain('SEMPRE convergir para a conversão');
  });

  it('EM_ANALISE ⇒ substitui; Workflow 1: só os 3 obrigatórios, nada além (15C)', () => {
    const p = politicaDaMissao(contexto({ missao: 'EM_ANALISE' }));
    expect(p.substituiCuriosidade).toBe(true);
    expect(p.conduta).toContain('HISCON já foi recebido e lido');
    expect(p.conduta).toContain('HISCON, RG ou CNH, e comprovante de endereço');
    expect(p.conduta).toContain('SOMENTE os que ainda faltam');
    expect(p.conduta).toContain('Responda IMEDIATAMENTE');
  });

  it('CLIENTE ⇒ NÃO substitui (conversa livre 9E) + reforço leve sem perder a missão', () => {
    const p = politicaDaMissao(contexto({ missao: 'CLIENTE' }));
    expect(p.substituiCuriosidade).toBe(false);
    expect(p.conduta).toBe('');
    expect(p.reforco).toContain('conversa livre é permitida');
    expect(p.reforco).toContain('nunca perca a missão');
  });

  it('POS_ATENDIMENTO ⇒ NÃO substitui, modo suporte e acompanhamento', () => {
    const p = politicaDaMissao(contexto({ missao: 'POS_ATENDIMENTO' }));
    expect(p.substituiCuriosidade).toBe(false);
    expect(p.reforco).toContain('suporte e acompanhamento');
  });

  it('regra 4 — "tenho direito?" ⇒ resposta CANÔNICA em LEAD e EM_ANALISE; não em CLIENTE', () => {
    expect(politicaDaMissao(contexto({ missao: 'LEAD', purpose: 'question', texto: 'tenho direito a revisão?' })).respostaCanonica).toBe(RESPOSTA_ELEGIBILIDADE);
    expect(politicaDaMissao(contexto({ missao: 'EM_ANALISE', purpose: 'question', texto: 'é meu direito?' })).respostaCanonica).toBe(RESPOSTA_ELEGIBILIDADE);
    expect(politicaDaMissao(contexto({ missao: 'CLIENTE', purpose: 'question', texto: 'tenho direito?' })).respostaCanonica).toBeNull();
  });

  it('pergunta direta detectada (question ou "?"); não-pergunta ⇒ false', () => {
    expect(politicaDaMissao(contexto({ missao: 'LEAD', purpose: 'question' })).perguntaDireta).toBe(true);
    expect(politicaDaMissao(contexto({ missao: 'LEAD', texto: 'quanto custa?' })).perguntaDireta).toBe(true);
    expect(politicaDaMissao(contexto({ missao: 'LEAD', texto: 'perdi dinheiro no consignado' })).perguntaDireta).toBe(false);
  });
});

describe('15B · HISCON First Policy — o HISCON é sempre o primeiro documento', () => {
  it('LEAD pede APENAS o HISCON e PROÍBE contratos antes de lê-lo', () => {
    const c = politicaDaMissao(contexto({ missao: 'LEAD' })).conduta;
    expect(c).toContain('solicitar APENAS o HISCON');
    expect(c).toContain('PROIBIDO pedir contratos ou qualquer outro documento antes de ler o HISCON');
    expect(c).toContain('Nunca peça vários documentos de uma vez');
    expect(c).not.toContain('HISCON e contratos');
  });
  it('a resposta canônica de elegibilidade cita SÓ o HISCON (fonte primária)', () => {
    expect(RESPOSTA_ELEGIBILIDADE).toContain('HISCON');
    expect(RESPOSTA_ELEGIBILIDADE).not.toMatch(/contratos/i);
  });
  it('EM_ANALISE assume o HISCON lido e pede só o que falta dos OBRIGATÓRIOS', () => {
    const c = politicaDaMissao(contexto({ missao: 'EM_ANALISE' })).conduta;
    expect(c).toContain('HISCON já foi recebido e lido');
    expect(c).toContain('SOMENTE os que ainda faltam');
    expect(c).toContain('nunca peça um documento que o cliente já enviou');
  });
});

describe('15C · Workflow 1 — documentação OBRIGATÓRIA (100% dos clientes)', () => {
  const c = politicaDaMissao(contexto({ missao: 'EM_ANALISE' })).conduta;
  it('os únicos obrigatórios são HISCON + RG/CNH + comprovante de endereço', () => {
    expect(c).toContain('apenas TRÊS: HISCON, RG ou CNH, e comprovante de endereço');
    expect(c).toContain('a documentação inicial está CONCLUÍDA');
  });
  it('PROIBIDO qualquer documento do Workflow 2 nesta fase (só o advogado solicita)', () => {
    expect(c).toContain('É PROIBIDO solicitar QUALQUER outro documento nesta fase');
    expect(c).toContain('NUNCA peça contratos, procuração, extratos, comprovantes bancários ou documentos judiciais');
    expect(c).toContain('só o ADVOGADO solicita');
  });
});

describe('15A · integração no PromptBuilder — o estado guia o styleGuidance', () => {
  const builder = new PromptBuilderRuntime(8);

  it('LEAD: styleGuidance COMERCIAL (substitui a curiosidade 9E)', () => {
    const req = builder.build(intent(), contexto({ missao: 'LEAD', purpose: 'greeting' }));
    expect(req.styleGuidance).toContain('ÚNICA missão é convertê-lo');
    expect(req.styleGuidance).not.toContain('retribua o cumprimento'); // conduta 9D suprimida
  });

  it('LEAD + "tenho direito?": a resposta canônica entra no styleGuidance', () => {
    const req = builder.build(intent(), contexto({ missao: 'LEAD', purpose: 'question', texto: 'tenho direito?' }));
    expect(req.styleGuidance).toContain(RESPOSTA_ELEGIBILIDADE);
  });

  it('EM_ANALISE: styleGuidance pede SOMENTE o que falta (HISCON já lido)', () => {
    const req = builder.build(intent(), contexto({ missao: 'EM_ANALISE', purpose: 'service_request' }));
    expect(req.styleGuidance).toContain('SOMENTE os que ainda faltam');
    expect(req.styleGuidance).not.toContain('HISCON e contratos');
  });

  it('CLIENTE: volta a curiosidade 9E + reforço (não comercial)', () => {
    const req = builder.build(intent(), contexto({ missao: 'CLIENTE', purpose: 'question' }));
    expect(req.styleGuidance).not.toContain('ÚNICA missão é convertê-lo');
    expect(req.styleGuidance).toContain('MENOR resposta verdadeira'); // 9E (informativo)
    expect(req.styleGuidance).toContain('nunca perca a missão'); // reforço 15A
  });

  it('styleGuidanceDaMissao vazio quando não substitui', () => {
    expect(styleGuidanceDaMissao(politicaDaMissao(contexto({ missao: 'CLIENTE' })))).toBe('');
  });
});

describe('15A · o estado é INTEGRADO ao ConversationContextView (ContextRuntime)', () => {
  const sessions = { getOrOpen: () => Promise.resolve({ chatId: 'c1', turns: 0, lastInboundAt: null, lastOutboundAt: null }) } as unknown as SessionRuntime;
  const memory = { recent: () => Promise.resolve([]), recentOutboundTexts: () => Promise.resolve([]) } as unknown as ConversationMemoryRuntime;
  const NOW = new Date('2026-07-19T12:00:00.000Z');

  it('sem provider ⇒ missaoDaConversa = LEAD (default explícito)', async () => {
    const rt = new ConversationContextRuntime(sessions, memory);
    const view = await rt.build('c1', null, NOW);
    expect(view.missaoDaConversa).toBe('LEAD');
  });

  it('com provider ⇒ o estado do domínio entra no contexto', async () => {
    const rt = new ConversationContextRuntime(sessions, memory, {}, undefined, () => Promise.resolve('CLIENTE'));
    const view = await rt.build('c1', null, NOW);
    expect(view.missaoDaConversa).toBe('CLIENTE');
  });

  it('provider falha ⇒ best-effort cai em LEAD (a conversa nunca quebra)', async () => {
    const rt = new ConversationContextRuntime(sessions, memory, {}, undefined, () => Promise.reject(new Error('down')));
    const view = await rt.build('c1', null, NOW);
    expect(view.missaoDaConversa).toBe('LEAD');
  });
});
