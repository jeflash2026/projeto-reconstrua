// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN INTELLIGENCE (GO-LIVE 11A) — testes da matriz jurídica ampliada do
// consignado INSS + validação do catálogo contra casos reais. A matriz cobre
// cada cenário com a estrutura completa (fatos mínimos, reforços, riscos,
// documentos esperados/opcionais, exclusão, prioridade); a validação encontra
// estratégias nunca usadas, conflitos, baixa confiança e lacunas.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { BrainFacts } from '../executive-brain/facts.js';
import { raciocinar } from './strategic-reasoning.js';
import { ESTRATEGIAS_CONSIGNADO_INSS } from './consignado-strategies.js';
import { validarCatalogo, type CasoReal } from './catalog-validation.js';
import { aprenderDaConversa } from '../conversation/conversation-knowledge.js';
import { CATALOGO_CONSIGNADO_INSS } from '../conversation/consignado-knowledge.js';
import { fatosEstrategicos } from './fatos-estrategicos.js';

const REFS = ESTRATEGIAS_CONSIGNADO_INSS.map((s) => s.ref);

describe('11A · a matriz completa — cada estratégia declara a estrutura do decreto', () => {
  it('toda estratégia indica fatos mínimos, docs esperados, ações, exclusão/ prioridade', () => {
    for (const s of ESTRATEGIAS_CONSIGNADO_INSS) {
      expect(s.requer.length).toBeGreaterThan(0); // fatos mínimos necessários
      expect(s.proximaAcao.length).toBeGreaterThan(0); // ações seguintes
      expect((s.documentosEsperados ?? []).length).toBeGreaterThan(0); // documentos esperados
      expect(typeof s.prioridade).toBe('number'); // critério de prioridade
      expect(s.fundamento.length).toBeGreaterThan(0); // rastreabilidade jurídica
      expect((s.prioridades ?? []).length).toBeGreaterThan(0); // critérios de prioridade (ações)
    }
  });

  it('a matriz cobre os novos cenários (RMC, margem, tarifas, portabilidade, superendividamento)', () => {
    expect(REFS).toEqual(
      expect.arrayContaining([
        'EST-CONSIG-REVISAO-001',
        'EST-CONSIG-NAO-CONTRATADO-001',
        'EST-CONSIG-JUROS-001',
        'EST-CONSIG-CARTAO-RMC-001',
        'EST-CONSIG-MARGEM-001',
        'EST-CONSIG-TARIFAS-001',
        'EST-CONSIG-PORTABILIDADE-001',
        'EST-CONSIG-SUPERENDIVIDAMENTO-001',
      ]),
    );
  });

  it('cartão RMC: fatos ⇒ hipótese própria com docs esperados (extrato de RMC)', () => {
    const r = raciocinar(
      {
        problema_principal: 'cartao_rmc',
        beneficio: 'aposentadoria',
        tempo_do_problema: 'mais_de_2_anos',
        multiplos_bancos: 'true',
      },
      ESTRATEGIAS_CONSIGNADO_INSS,
    );
    expect(r.hipotesePrincipal?.ref).toBe('EST-CONSIG-CARTAO-RMC-001');
    expect(r.hipotesePrincipal?.confianca).toBe('alta'); // 3 reforços
    expect(r.hipotesePrincipal?.documentosEsperados).toContain(
      'extrato da RMC / cartão consignado',
    );
  });

  it('superendividamento vence por PRIORIDADE de domínio quando empata em confiança', () => {
    // margem_extrapolada e superendividamento não coexistem (um problema_principal),
    // então testamos a prioridade declarada: superendividamento (90) > revisão (60).
    const superend = ESTRATEGIAS_CONSIGNADO_INSS.find(
      (s) => s.ref === 'EST-CONSIG-SUPERENDIVIDAMENTO-001',
    );
    const revisao = ESTRATEGIAS_CONSIGNADO_INSS.find((s) => s.ref === 'EST-CONSIG-REVISAO-001');
    expect(superend?.prioridade ?? 0).toBeGreaterThan(revisao?.prioridade ?? 0);
  });

  it('CRITÉRIO DE EXCLUSÃO: processo ENCERRADO desqualifica a estratégia (não inventa nova)', () => {
    const facts: BrainFacts = {
      problema_principal: 'descontos_nao_reconhecidos',
      beneficio: 'aposentadoria',
      stateCode: 'ENCERRADA',
    };
    const r = raciocinar(facts, ESTRATEGIAS_CONSIGNADO_INSS);
    expect(r.hipoteses.some((h) => h.ref === 'EST-CONSIG-REVISAO-001')).toBe(false);
  });
});

describe('11A · regressão — os cenários homologados (10A) seguem idênticos', () => {
  it('o cliente do decreto ⇒ revisão contratual, confiança alta, mesma próxima ação', () => {
    const r = raciocinar(
      {
        beneficio: 'aposentadoria',
        documentacao_mencionada: 'hiscon',
        problema_principal: 'descontos_nao_reconhecidos',
        tempo_do_problema: 'mais_de_2_anos',
        multiplos_bancos: 'true',
      },
      ESTRATEGIAS_CONSIGNADO_INSS,
    );
    expect(r.hipotesePrincipal?.ref).toBe('EST-CONSIG-REVISAO-001');
    expect(r.hipotesePrincipal?.confianca).toBe('alta');
    expect(r.proximaMelhorAcao?.acao).toContain('Validar documentação complementar');
  });
});

describe('11A · validação do catálogo contra casos reais', () => {
  // Casos reais anonimizados — um por cenário + um propositalmente descoberto.
  const casosReais: readonly CasoReal[] = [
    {
      ref: 'C1-revisao',
      facts: {
        problema_principal: 'descontos_nao_reconhecidos',
        beneficio: 'aposentadoria',
        documentacao_mencionada: 'hiscon',
        tempo_do_problema: 'mais_de_2_anos',
        multiplos_bancos: 'true',
      },
    },
    {
      ref: 'C2-fraude',
      facts: { problema_principal: 'emprestimo_nao_contratado', tempo_do_problema: 'recente' },
    },
    { ref: 'C3-juros', facts: { problema_principal: 'juros_abusivos', multiplos_bancos: 'true' } },
    { ref: 'C4-rmc', facts: { problema_principal: 'cartao_rmc', beneficio: 'aposentadoria' } },
    {
      ref: 'C5-margem',
      facts: { problema_principal: 'margem_extrapolada', multiplos_bancos: 'true' },
    },
    {
      ref: 'C6-tarifas',
      facts: { problema_principal: 'tarifas_indevidas', documentacao_mencionada: 'contrato' },
    },
    {
      ref: 'C7-portabilidade',
      facts: { problema_principal: 'portabilidade_indevida', multiplos_bancos: 'true' },
    },
    {
      ref: 'C8-superend',
      facts: {
        problema_principal: 'superendividamento',
        multiplos_bancos: 'true',
        beneficio: 'pensao',
      },
    },
    {
      ref: 'C9-desconhecido',
      facts: { problema_principal: 'assunto_fora_do_dominio', beneficio: 'aposentadoria' },
    },
  ];

  const achados = validarCatalogo(ESTRATEGIAS_CONSIGNADO_INSS, casosReais);

  it('nenhuma estratégia fica sem uso quando a bateria cobre a matriz', () => {
    expect(achados.estrategiasNuncaUtilizadas).toEqual([]);
    expect(achados.cobertura.utilizadas).toBe(ESTRATEGIAS_CONSIGNADO_INSS.length);
  });

  it('detecta LACUNA: caso fora do domínio não casa com nenhuma estratégia', () => {
    expect(achados.lacunas).toContain('C9-desconhecido');
  });

  it('sem conflitos no topo (o desempate por prioridade evita ambiguidade)', () => {
    expect(achados.casosConflitantes).toEqual([]);
  });

  it('sinaliza estratégias de baixa confiança (as que nunca alcançam "alta" na bateria)', () => {
    // Ex.: fraude/juros/tarifas com poucos reforços permanecem em confiança média.
    const refsBaixa = achados.estrategiasBaixaConfianca.map((e) => e.ref);
    expect(refsBaixa).toContain('EST-CONSIG-TARIFAS-001');
    for (const e of achados.estrategiasBaixaConfianca) expect(e.melhorConfianca).not.toBe('alta');
  });

  it('uma estratégia NUNCA utilizada é detectada quando a bateria não a cobre', () => {
    const semRmc = validarCatalogo(
      ESTRATEGIAS_CONSIGNADO_INSS,
      casosReais.filter((c) => c.ref !== 'C4-rmc'),
    );
    expect(semRmc.estrategiasNuncaUtilizadas).toContain('EST-CONSIG-CARTAO-RMC-001');
  });
});

describe('11A · ponta a ponta — a conversa aprende o novo cenário e a estratégia nasce', () => {
  it('"cartão consignado / RMC" aprendido (9G/11A) ⇒ hipótese de RMC no raciocínio', () => {
    const ctx = {
      chatId: 'c1',
      session: { chatId: 'c1', turns: 2, lastInboundAt: null, lastOutboundAt: null },
      recentEntries: [
        {
          id: 'e1',
          chatId: 'c1',
          kind: 'outbound' as const,
          at: new Date(2026, 6, 19, 12, 1),
          text: 'O que está acontecendo com seu benefício?',
          intentDirective: null,
          operationalRuleRef: null,
          meta: {},
        },
        {
          id: 'e2',
          chatId: 'c1',
          kind: 'inbound' as const,
          at: new Date(2026, 6, 19, 12, 2),
          text: 'Tem uma reserva de margem do cartão consignado que eu não pedi, sou aposentado.',
          intentDirective: null,
          operationalRuleRef: null,
          meta: {},
        },
      ],
      recentOutboundTexts: ['O que está acontecendo com seu benefício?'],
      lastPercept: {
        envelope: {
          text: 'Tem uma reserva de margem do cartão consignado que eu não pedi, sou aposentado.',
        },
        enrichment: { perceivedPurpose: 'service_request', detectedIntentSignal: null },
      } as never,
      silenceMs: null,
    } as never;

    const conhecimento = aprenderDaConversa(ctx, CATALOGO_CONSIGNADO_INSS);
    const facts = fatosEstrategicos({ conhecimento });
    expect(facts['problema_principal']).toBe('cartao_rmc');
    expect(facts['beneficio']).toBe('aposentadoria');

    const r = raciocinar(facts, ESTRATEGIAS_CONSIGNADO_INSS);
    expect(r.hipotesePrincipal?.ref).toBe('EST-CONSIG-CARTAO-RMC-001');
  });
});
