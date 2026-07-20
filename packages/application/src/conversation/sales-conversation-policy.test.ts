// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MISSION POLICY (GO-LIVE 15A · Decreto "Jornada Documental
// Inicial") — testes: a conversa é guiada por um ESTADO EXPLÍCITO da missão
// (LEAD/ONBOARDING_DOCUMENTAL/ANALISE_ADMINISTRATIVA/CLIENTE/POS_ATENDIMENTO).
// LEAD e ONBOARDING têm prioridade (substituem a curiosidade 9E); os demais
// liberam a conversa livre com reforço. O estado é derivado do domínio.
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
function contexto(
  over: {
    missao?: MissaoDaConversa;
    purpose?: PerceivedPurpose;
    texto?: string | null;
    arquivo?: string;
    onboarding?: { recebidos: string[]; faltando: string[]; proximo: string | null } | null;
  } = {},
): ConversationContextView {
  return {
    chatId: 'c1',
    session: { chatId: 'c1', turns: 2, lastInboundAt: null, lastOutboundAt: null },
    recentEntries: [],
    recentOutboundTexts: [],
    lastPercept: {
      envelope: { text: over.texto ?? null, fileName: over.arquivo ?? null, mediaUrl: over.arquivo !== undefined ? 'https://wa/m1' : null },
      enrichment: { perceivedPurpose: over.purpose ?? 'unknown', detectedIntentSignal: null },
    } as never,
    silenceMs: null,
    casoFatos: null,
    ...(over.missao !== undefined ? { missaoDaConversa: over.missao } : {}),
    ...(over.onboarding !== undefined ? { onboardingDocumental: over.onboarding } : {}),
  } as unknown as ConversationContextView;
}

const SEM_DOCS = { documentacaoInicialCompleta: false } as const;

describe('Decreto · derivação a partir da MISSÃO ATIVA + Jornada 1', () => {
  it('sem missão ativa ⇒ LEAD, mesmo com outros sinais', () => {
    expect(derivarMissaoDaConversa({ missaoAtiva: false, vendaRegistrada: false, processoEncerrado: false, ...SEM_DOCS })).toBe('LEAD');
    expect(derivarMissaoDaConversa({ missaoAtiva: false, vendaRegistrada: true, processoEncerrado: true, documentacaoInicialCompleta: true })).toBe('LEAD');
  });
  it('missão ativa + documento obrigatório pendente ⇒ ONBOARDING_DOCUMENTAL', () => {
    expect(derivarMissaoDaConversa({ missaoAtiva: true, vendaRegistrada: false, processoEncerrado: false, ...SEM_DOCS })).toBe('ONBOARDING_DOCUMENTAL');
  });
  it('documentação 100% ⇒ ANALISE_ADMINISTRATIVA — a mudança é automática', () => {
    expect(derivarMissaoDaConversa({ missaoAtiva: true, vendaRegistrada: false, processoEncerrado: false, documentacaoInicialCompleta: true })).toBe('ANALISE_ADMINISTRATIVA');
  });
  it('VENDIDO ⇒ CLIENTE; ENCERRADA ⇒ POS_ATENDIMENTO (precedem a jornada)', () => {
    expect(derivarMissaoDaConversa({ missaoAtiva: true, vendaRegistrada: true, processoEncerrado: false, ...SEM_DOCS })).toBe('CLIENTE');
    expect(derivarMissaoDaConversa({ missaoAtiva: true, vendaRegistrada: true, processoEncerrado: true, documentacaoInicialCompleta: true })).toBe('POS_ATENDIMENTO');
  });
  it('cada estado tem um OBJETIVO de missão', () => {
    expect(politicaDaMissao(contexto({ missao: 'LEAD' })).objetivo).toBe('Converter Lead');
    expect(politicaDaMissao(contexto({ missao: 'ONBOARDING_DOCUMENTAL' })).objetivo).toBe('Completar a Documentação Inicial');
    expect(politicaDaMissao(contexto({ missao: 'ANALISE_ADMINISTRATIVA' })).objetivo).toBe('Acompanhar a Análise Administrativa');
    expect(politicaDaMissao(contexto({ missao: 'CLIENTE' })).objetivo).toBe('Acompanhar Processo');
    expect(politicaDaMissao(contexto({ missao: 'POS_ATENDIMENTO' })).objetivo).toBe('Suporte');
  });
});

describe('15A · a política por ESTADO da missão', () => {
  it('AUSENTE ⇒ LEAD (todo novo contato é lead)', () => {
    expect(politicaDaMissao(contexto({})).missao).toBe('LEAD');
  });

  it('Q4 — estado INVÁLIDO/desconhecido (incl. o antigo EM_ANALISE) ⇒ LEAD seguro', () => {
    for (const ruimStr of ['ESTADO_INEXISTENTE', 'EM_ANALISE']) {
      const ruim = { ...contexto({}), missaoDaConversa: ruimStr } as unknown as ConversationContextView;
      const p = politicaDaMissao(ruim);
      expect(p.missao).toBe('LEAD');
      expect(p.substituiCuriosidade).toBe(true); // nunca undefined — nunca quebra o PromptBuilder
    }
  });

  it('LEAD (Tráfego Pago) ⇒ sequência fixa: boas-vindas → nome → explicação → consentimento → triagem', () => {
    const p = politicaDaMissao(contexto({ missao: 'LEAD' }));
    expect(p.substituiCuriosidade).toBe(true);
    expect(p.conduta).toContain('vou te acompanhar do começo ao fim');
    expect(p.conduta).toContain('NOME COMPLETO');
    expect(p.conduta).toContain('SEM PROMESSAS');
    expect(p.conduta).toContain('NUNCA garanta resultado');
    expect(p.conduta).toContain('interesse em fazer a análise');
    expect(p.conduta).toContain('APENAS TRÊS documentos, UM POR VEZ');
    expect(p.conduta).toContain('RG (frente e verso) ou CNH');
    expect(p.conduta).toContain('Responda IMEDIATAMENTE');
    expect(p.conduta).toContain('NUNCA devolva uma pergunta antes de responder');
    expect(p.conduta).toContain('menos de 80 palavras');
    expect(p.conduta).toContain('NUNCA peça contratos, procuração');
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

  it('regra 4 — "tenho direito?" ⇒ canônica em LEAD e ONBOARDING; não em ANÁLISE/CLIENTE', () => {
    expect(politicaDaMissao(contexto({ missao: 'LEAD', purpose: 'question', texto: 'tenho direito a revisão?' })).respostaCanonica).toBe(RESPOSTA_ELEGIBILIDADE);
    expect(politicaDaMissao(contexto({ missao: 'ONBOARDING_DOCUMENTAL', purpose: 'question', texto: 'é meu direito?' })).respostaCanonica).toBe(RESPOSTA_ELEGIBILIDADE);
    expect(politicaDaMissao(contexto({ missao: 'ANALISE_ADMINISTRATIVA', purpose: 'question', texto: 'tenho direito?' })).respostaCanonica).toBeNull();
    expect(politicaDaMissao(contexto({ missao: 'CLIENTE', purpose: 'question', texto: 'tenho direito?' })).respostaCanonica).toBeNull();
  });

  it('pergunta direta detectada (question ou "?"); não-pergunta ⇒ false', () => {
    expect(politicaDaMissao(contexto({ missao: 'LEAD', purpose: 'question' })).perguntaDireta).toBe(true);
    expect(politicaDaMissao(contexto({ missao: 'LEAD', texto: 'quanto custa?' })).perguntaDireta).toBe(true);
    expect(politicaDaMissao(contexto({ missao: 'LEAD', texto: 'perdi dinheiro no consignado' })).perguntaDireta).toBe(false);
  });
});

describe('Decreto · JORNADA 1 — ONBOARDING_DOCUMENTAL', () => {
  it('substitui a curiosidade; documentação FIXA de TRÊS, na ordem do decreto, um por vez', () => {
    const p = politicaDaMissao(contexto({ missao: 'ONBOARDING_DOCUMENTAL' }));
    expect(p.substituiCuriosidade).toBe(true);
    expect(p.conduta).toContain('100% da documentação inicial FIXA');
    expect(p.conduta).toContain('nesta ordem: RG (frente e verso) ou CNH, comprovante de endereço, e HISCON');
    expect(p.conduta).toContain('um por vez, nunca vários');
  });

  it('conduta DINÂMICA: confirma os recebidos e solicita AGORA o próximo que falta', () => {
    const p = politicaDaMissao(contexto({
      missao: 'ONBOARDING_DOCUMENTAL',
      onboarding: {
        recebidos: ['HISCON (histórico de empréstimos consignados do INSS)'],
        faltando: ['RG ou CNH (documento de identidade com foto)', 'comprovante de endereço'],
        proximo: 'RG ou CNH (documento de identidade com foto)',
      },
    }));
    expect(p.conduta).toContain('Já recebidos e CONFIRMADOS: HISCON');
    expect(p.conduta).toContain('Ainda faltam: RG ou CNH');
    expect(p.conduta).toContain('Solicite AGORA, nesta resposta, APENAS o próximo: RG ou CNH');
  });

  it('sem contabilidade semeada ⇒ começa pelo RG/CNH (ordem do decreto)', () => {
    const p = politicaDaMissao(contexto({ missao: 'ONBOARDING_DOCUMENTAL', onboarding: null }));
    expect(p.conduta).toContain('comece pelo RG (frente e verso) ou CNH');
  });

  it('nunca encerra, nunca "vou analisar", nunca deixa aguardando', () => {
    const c = politicaDaMissao(contexto({ missao: 'ONBOARDING_DOCUMENTAL' })).conduta;
    expect(c).toContain('NUNCA diga que vai analisar o caso agora');
    expect(c).toContain('NUNCA encerre o atendimento');
    expect(c).toContain('NUNCA deixe o cliente aguardando');
    expect(c).toContain('enquanto faltar documento, a conversa continua');
  });

  it('PROIBIDO qualquer documento da Jornada 2 (complementares só pelo Painel do Advogado)', () => {
    const c = politicaDaMissao(contexto({ missao: 'ONBOARDING_DOCUMENTAL' })).conduta;
    expect(c).toContain('É PROIBIDO solicitar QUALQUER outro documento nesta fase');
    expect(c).toContain('NUNCA peça contratos, procuração, extratos, comprovantes bancários ou documentos judiciais');
    expect(c).toContain('Painel do Advogado (Jornada 2)');
  });

  it('GUARDA GO-LIVE: arquivo enviado NESTE turno ⇒ agradece SEM pular etapa', () => {
    const c = politicaDaMissao(contexto({ missao: 'ONBOARDING_DOCUMENTAL', arquivo: 'hiscon.pdf' })).conduta;
    expect(c).toContain('ACABOU de enviar um arquivo NESTA mensagem');
    expect(c).toContain('agradeça e confirme o recebimento');
    expect(c).toContain('NUNCA pule etapas');
    // Regressão da 3ª rodada: a guarda antiga mandava "mencionar o outro
    // documento" — e a AHRI saltava do RG-frente direto ao comprovante.
    expect(c).not.toContain('mencione apenas esse outro');
    expect(c).toContain('se ele pedir o VERSO do RG, peça o verso');
    expect(c).toContain('NÃO avance para um documento novo');
    expect(c).toContain('FRENTE e do VERSO');
  });

  it('guarda + contabilidade com RG de 1 face ⇒ o "Solicite AGORA" pede o VERSO e a guarda o permite', () => {
    const c = politicaDaMissao(contexto({
      missao: 'ONBOARDING_DOCUMENTAL',
      arquivo: 'IMG_1.jpg',
      onboarding: {
        recebidos: ['RG (uma das faces)'],
        faltando: ['o VERSO do RG (a parte de trás do documento)', 'comprovante de endereço', 'HISCON (histórico de empréstimos consignados do INSS)'],
        proximo: 'o VERSO do RG (a parte de trás do documento)',
      },
    })).conduta;
    expect(c).toContain('Solicite AGORA, nesta resposta, APENAS o próximo: o VERSO do RG');
    expect(c).toContain('é a OUTRA FACE do mesmo documento');
  });

  it('sem arquivo no turno ⇒ a guarda não aparece', () => {
    const c = politicaDaMissao(contexto({ missao: 'ONBOARDING_DOCUMENTAL', texto: 'oi' })).conduta;
    expect(c).not.toContain('ACABOU de enviar um arquivo');
  });
});

describe('Decreto · ANALISE_ADMINISTRATIVA — conversa normal, zero pedido espontâneo', () => {
  const p = politicaDaMissao(contexto({ missao: 'ANALISE_ADMINISTRATIVA' }));
  it('NÃO substitui a curiosidade (conversa normal durante a análise)', () => {
    expect(p.substituiCuriosidade).toBe(false);
    expect(p.conduta).toBe('');
  });
  it('responde dúvidas, informa andamento, sigilo, sem inventar prazos', () => {
    expect(p.reforco).toContain('em análise administrativa');
    expect(p.reforco).toContain('informe o andamento');
    expect(p.reforco).toContain('sigilo da empresa');
    expect(p.reforco).toContain('NUNCA revele dados de terceiros');
    expect(p.reforco).toContain('NUNCA invente prazos');
  });
  it('NUNCA solicita documentos por iniciativa própria — só DocumentRequest ativo', () => {
    expect(p.reforco).toContain('NUNCA solicite documentos por iniciativa própria');
    expect(p.reforco).toContain('solicitação ATIVA do advogado');
    expect(p.reforco).toContain('MISSÃO OPERACIONAL');
  });
});

describe('Decreto Tráfego Pago — a triagem REVOGA o HISCON-first do 15B', () => {
  it('a ordem da triagem é RG/CNH → comprovante → HISCON (um por vez)', () => {
    const c = politicaDaMissao(contexto({ missao: 'LEAD' })).conduta;
    expect(c).toContain('RG (frente e verso) ou CNH');
    expect(c).toContain('comprovante de endereço e, por último, o HISCON');
    expect(c).toContain('NUNCA peça vários documentos de uma vez');
  });
  it('a resposta canônica de elegibilidade continua citando SÓ o HISCON (fonte da análise)', () => {
    expect(RESPOSTA_ELEGIBILIDADE).toContain('HISCON');
    expect(RESPOSTA_ELEGIBILIDADE).not.toMatch(/contratos/i);
  });
  it('ONBOARDING segue a MESMA ordem do decreto', () => {
    const c = politicaDaMissao(contexto({ missao: 'ONBOARDING_DOCUMENTAL' })).conduta;
    expect(c).toContain('nesta ordem: RG (frente e verso) ou CNH');
  });
  it('SEM PROMESSAS: nunca garantir resultado, valores ou prazos', () => {
    const c = politicaDaMissao(contexto({ missao: 'LEAD' })).conduta;
    expect(c).toContain('NUNCA garanta resultado');
    expect(c).toContain('NUNCA cite valores');
    expect(c).toContain('NUNCA invente prazos');
  });
});

describe('15A · integração no PromptBuilder — o estado guia o styleGuidance', () => {
  const builder = new PromptBuilderRuntime(8);

  it('LEAD: styleGuidance da sequência de boas-vindas (substitui a curiosidade 9E)', () => {
    const req = builder.build(intent(), contexto({ missao: 'LEAD', purpose: 'greeting' }));
    expect(req.styleGuidance).toContain('vou te acompanhar do começo ao fim');
    expect(req.styleGuidance).not.toContain('retribua o cumprimento'); // conduta 9D suprimida
  });

  it('LEAD + "tenho direito?": a resposta canônica entra no styleGuidance', () => {
    const req = builder.build(intent(), contexto({ missao: 'LEAD', purpose: 'question', texto: 'tenho direito?' }));
    expect(req.styleGuidance).toContain(RESPOSTA_ELEGIBILIDADE);
  });

  it('ONBOARDING: styleGuidance pede o PRÓXIMO da contabilidade', () => {
    const req = builder.build(intent(), contexto({
      missao: 'ONBOARDING_DOCUMENTAL',
      purpose: 'service_request',
      onboarding: { recebidos: [], faltando: ['HISCON (histórico de empréstimos consignados do INSS)'], proximo: 'HISCON (histórico de empréstimos consignados do INSS)' },
    }));
    expect(req.styleGuidance).toContain('Solicite AGORA, nesta resposta, APENAS o próximo: HISCON');
  });

  it('ANALISE_ADMINISTRATIVA: conversa livre 9E + reforço (zero pedido espontâneo)', () => {
    const req = builder.build(intent(), contexto({ missao: 'ANALISE_ADMINISTRATIVA', purpose: 'question' }));
    expect(req.styleGuidance).not.toContain('vou te acompanhar do começo ao fim');
    expect(req.styleGuidance).toContain('NUNCA solicite documentos por iniciativa própria');
  });

  it('CLIENTE: volta a curiosidade 9E + reforço (não comercial)', () => {
    const req = builder.build(intent(), contexto({ missao: 'CLIENTE', purpose: 'question' }));
    expect(req.styleGuidance).not.toContain('vou te acompanhar do começo ao fim');
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
    const rt = new ConversationContextRuntime(sessions, memory, {}, undefined, () => Promise.resolve('ANALISE_ADMINISTRATIVA'));
    const view = await rt.build('c1', null, NOW);
    expect(view.missaoDaConversa).toBe('ANALISE_ADMINISTRATIVA');
  });

  it('provider falha ⇒ best-effort cai em LEAD (a conversa nunca quebra)', async () => {
    const rt = new ConversationContextRuntime(sessions, memory, {}, undefined, () => Promise.reject(new Error('down')));
    const view = await rt.build('c1', null, NOW);
    expect(view.missaoDaConversa).toBe('LEAD');
  });

  it('provider de onboarding ⇒ a contabilidade da Jornada 1 entra no contexto', async () => {
    const rt = new ConversationContextRuntime(sessions, memory, {}, undefined, undefined, undefined, () =>
      Promise.resolve({ recebidos: [], faltando: ['comprovante de endereço'], proximo: 'comprovante de endereço' }),
    );
    const view = await rt.build('c1', null, NOW);
    expect(view.onboardingDocumental?.proximo).toBe('comprovante de endereço');
  });
});
