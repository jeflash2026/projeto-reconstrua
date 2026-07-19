// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION KNOWLEDGE (GO-LIVE 9G) — testes com o DIÁLOGO CONSIGNADO INSS do
// decreto: a conversa aprende FATOS progressivamente (nunca perguntas, nunca
// respostas literais), jamais repergunta um fato aprendido, atualiza fato que
// muda, e o motor é genérico (trocar o catálogo troca o domínio).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ConversationIntent } from './intent.js';
import type { ConversationContextView, MemoryEntry } from './ports.js';
import { aprenderDaConversa, resumoDoConhecimento, type CatalogoDeConhecimento } from './conversation-knowledge.js';
import { CATALOGO_CONSIGNADO_INSS } from './consignado-knowledge.js';
import { conduzirTurno } from './conversation-intelligence.js';
import { PromptBuilderRuntime } from './prompt-builder-runtime.js';

let seq = 0;
function entry(kind: MemoryEntry['kind'], text: string | null, minuto: number): MemoryEntry {
  seq += 1;
  return {
    id: `e${String(seq)}`, chatId: 'c1', kind, at: new Date(2026, 6, 19, 12, minuto), text,
    intentDirective: null, operationalRuleRef: null, meta: {},
  };
}

function intent(): ConversationIntent {
  return {
    id: 'i1', chatId: 'c1', directive: 'speak', speechAct: 'explain', topic: 'relacionamento',
    references: [], urgency: 'normal', operationalRuleRef: 'RO-X', fundamento: 'f',
    timingHintMs: null, formedAt: new Date('2026-07-19T12:00:00.000Z'),
  };
}

function contexto(entries: MemoryEntry[], inboundAtual: string): ConversationContextView {
  return {
    chatId: 'c1',
    session: { chatId: 'c1', turns: entries.length, lastInboundAt: null, lastOutboundAt: null },
    recentEntries: entries,
    recentOutboundTexts: entries.filter((e) => e.kind === 'outbound' && e.text !== null).map((e) => e.text ?? '').reverse(),
    lastPercept: { envelope: { text: inboundAtual }, enrichment: { perceivedPurpose: 'service_request', detectedIntentSignal: null } } as never,
    silenceMs: null,
  } as unknown as ConversationContextView;
}

/** O diálogo consignado do decreto, completo (4 descobertas). */
function dialogoConsignado(): MemoryEntry[] {
  return [
    entry('outbound', 'O que aconteceu com seu empréstimo consignado?', 1),
    entry('inbound', 'Descontam parcelas que eu não reconheço.', 2),
    entry('outbound', 'Esses descontos acontecem há muito tempo?', 3),
    entry('inbound', 'Há mais de dois anos.', 4),
    entry('outbound', 'Você recebe aposentadoria ou pensão?', 5),
    entry('inbound', 'Aposentadoria.', 6),
    entry('outbound', 'Você possui contratos em mais de um banco?', 7),
    entry('inbound', 'Sim.', 8),
  ];
}

function fatosMap(ctx: ConversationContextView) {
  return Object.fromEntries(aprenderDaConversa(ctx, CATALOGO_CONSIGNADO_INSS).map((f) => [f.factKey, f]));
}

describe('Conversation Knowledge · o diálogo consignado do decreto', () => {
  it('aprende os 4 fatos exatamente como decretado', () => {
    const fatos = fatosMap(contexto(dialogoConsignado(), 'Sim.'));
    expect(fatos['problema_principal']?.valor).toBe('descontos_nao_reconhecidos');
    expect(fatos['tempo_do_problema']?.valor).toBe('mais_de_2_anos');
    expect(fatos['beneficio']?.valor).toBe('aposentadoria');
    expect(fatos['multiplos_bancos']?.valor).toBe('true'); // "Sim." só ensina diante da pergunta certa
  });

  it('estrutura completa: factKey, valor, origem (auditável) e confiança', () => {
    const fatos = fatosMap(contexto(dialogoConsignado(), 'Sim.'));
    const beneficio = fatos['beneficio'];
    expect(beneficio?.origem).toContain('Aposentadoria');
    expect(beneficio?.confianca).toBe('alta');
    expect(fatos['multiplos_bancos']?.confianca).toBe('media'); // sim/não contextual = média
  });

  it('nunca guarda perguntas nem respostas literais como conhecimento', () => {
    const resumo = resumoDoConhecimento(aprenderDaConversa(contexto(dialogoConsignado(), 'Sim.'), CATALOGO_CONSIGNADO_INSS));
    expect(resumo).toBe('problema_principal=descontos_nao_reconhecidos; tempo_do_problema=mais_de_2_anos; beneficio=aposentadoria; multiplos_bancos=true');
    expect(resumo).not.toContain('?');
    expect(resumo).not.toContain('Descontam parcelas');
  });

  it('fato que MUDA na conversa é ATUALIZADO (o mais recente vence)', () => {
    const entries = [
      ...dialogoConsignado(),
      entry('outbound', 'Certo.', 9),
      entry('inbound', 'na verdade é pensão, me confundi', 10),
    ];
    const fatos = fatosMap(contexto(entries, 'na verdade é pensão, me confundi'));
    expect(fatos['beneficio']?.valor).toBe('pensao'); // atualizado
  });

  it('hiscon mencionado e interesse em revisão também são aprendidos', () => {
    const entries = [
      entry('inbound', 'eu tenho o hiscon aqui e quero a revisão dos contratos', 1),
    ];
    const fatos = fatosMap(contexto(entries, 'eu tenho o hiscon aqui e quero a revisão dos contratos'));
    expect(fatos['documentacao_mencionada']?.valor).toBe('hiscon');
    expect(fatos['interesse']?.valor).toBe('revisao_consignado');
  });
});

describe('Conversation Knowledge · conduz a conversa (Memory + Knowledge)', () => {
  it('a conduta proíbe reperguntar fato aprendido e o resumo chega ao fraseado', () => {
    const ctx = contexto(dialogoConsignado(), 'Sim.');
    const conduta = conduzirTurno(intent(), ctx);
    expect(conduta.conhecimentoResumo).toContain('beneficio=aposentadoria');
    expect(conduta.conduta).toContain('JAMAIS pergunte algo cujo fato já foi aprendido');

    const req = new PromptBuilderRuntime(8).build(intent(), ctx);
    expect(req.context.conhecimentoDaConversa).toContain('multiplos_bancos=true');
  });

  it('motor GENÉRICO: trocar o catálogo troca o domínio (nenhum acoplamento)', () => {
    const catalogoOutroProduto: CatalogoDeConhecimento = [
      { factKey: 'porte_da_empresa', detectar: (r) => (/pequena empresa|mei\b/.test(r) ? { valor: 'pequena' } : null) },
    ];
    const ctx = contexto([entry('inbound', 'tenho uma pequena empresa', 1)], 'tenho uma pequena empresa');
    const fatos = aprenderDaConversa(ctx, catalogoOutroProduto);
    expect(fatos).toEqual([
      expect.objectContaining({ factKey: 'porte_da_empresa', valor: 'pequena', confianca: 'alta' }),
    ]);
    // E o mesmo diálogo com o catálogo consignado não aprende nada — domínios isolados.
    expect(aprenderDaConversa(ctx, CATALOGO_CONSIGNADO_INSS)).toEqual([]);
  });
});
