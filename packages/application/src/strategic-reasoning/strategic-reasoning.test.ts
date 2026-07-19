// ─────────────────────────────────────────────────────────────────────────────
// STRATEGIC REASONING (GO-LIVE 10A) — testes: o EXEMPLO do decreto produz a
// estratégia decretada; conjuntos de fatos DIFERENTES produzem estratégias
// DIFERENTES; nada é inventado sem fatos; e toda decisão carrega rastreabilidade
// completa (ref + fatos sustentadores + justificativa + confiança + fundamento).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { BrainFacts } from '../executive-brain/facts.js';
import { raciocinar, type CatalogoDeEstrategias } from './strategic-reasoning.js';
import { ESTRATEGIAS_CONSIGNADO_INSS } from './consignado-strategies.js';
import { fatosEstrategicos } from './fatos-estrategicos.js';

/** O cliente do EXEMPLO do decreto: aposentadoria + HISCON + descontos não
 *  reconhecidos + mais de dois anos + múltiplos bancos. */
const CLIENTE_DO_DECRETO: BrainFacts = {
  beneficio: 'aposentadoria',
  documentacao_mencionada: 'hiscon',
  problema_principal: 'descontos_nao_reconhecidos',
  tempo_do_problema: 'mais_de_2_anos',
  multiplos_bancos: 'true',
};

describe('Strategic Reasoning · o exemplo do decreto', () => {
  const r = raciocinar(CLIENTE_DO_DECRETO, ESTRATEGIAS_CONSIGNADO_INSS);

  it('hipótese principal: revisão contratual, com confiança ALTA', () => {
    expect(r.hipotesePrincipal?.ref).toBe('EST-CONSIG-REVISAO-001');
    expect(r.hipotesePrincipal?.hipotese).toContain('Revisão contratual');
    expect(r.hipotesePrincipal?.confianca).toBe('alta'); // 3 reforços presentes
  });

  it('prioridade: solicitar extrato INSS para confirmar vínculos (com justificativa)', () => {
    const p = r.prioridades.find((x) => x.acao.includes('extrato INSS'));
    expect(p).toBeDefined();
    expect(p?.justificativa).toContain('múltiplos bancos');
    expect(p?.ref).toBe('EST-CONSIG-REVISAO-001');
  });

  it('risco: contratos em múltiplas instituições — sustentado pelo fato exato', () => {
    const risco = r.riscos.find((x) => x.risco.includes('múltiplas instituições'));
    expect(risco).toBeDefined();
    expect(risco?.sustentadoPor).toContain('multiplos_bancos=true');
  });

  it('próxima melhor ação: validar documentação complementar, com justificativa e confiança', () => {
    expect(r.proximaMelhorAcao?.acao).toContain('Validar documentação complementar');
    expect(r.proximaMelhorAcao?.confianca).toBe('alta');
    expect(r.proximaMelhorAcao?.justificativa).toContain('EST-CONSIG-REVISAO-001');
    expect(r.proximaMelhorAcao?.justificativa).toContain('problema_principal=descontos_nao_reconhecidos');
  });

  it('RASTREABILIDADE completa: fatos sustentadores + reforços + fundamento + auditoria', () => {
    const h = r.hipotesePrincipal;
    expect(h?.sustentadaPor).toEqual([
      'problema_principal=descontos_nao_reconhecidos',
      'beneficio=aposentadoria',
    ]);
    expect(h?.reforcadaPor).toContain('tempo_do_problema=mais_de_2_anos');
    expect(h?.reforcadaPor).toContain('documentacao_mencionada=hiscon');
    expect(h?.fundamento).toContain('Lei 10.820');
    expect(r.auditoria.estrategiasAvaliadas).toBe(ESTRATEGIAS_CONSIGNADO_INSS.length);
    expect(r.auditoria.fatosConsiderados).toContain('multiplos_bancos=true');
  });

  it('oportunidade: HISCON em mãos — análise pode começar', () => {
    expect(r.oportunidades.some((o) => o.oportunidade.includes('HISCON'))).toBe(true);
  });
});

describe('Strategic Reasoning · fatos diferentes ⇒ estratégias diferentes', () => {
  it('empréstimo NÃO contratado ⇒ hipótese de fraude (nunca a de revisão)', () => {
    const r = raciocinar(
      { problema_principal: 'emprestimo_nao_contratado', tempo_do_problema: 'recente' },
      ESTRATEGIAS_CONSIGNADO_INSS,
    );
    expect(r.hipotesePrincipal?.ref).toBe('EST-CONSIG-NAO-CONTRATADO-001');
    expect(r.hipoteses.some((h) => h.ref === 'EST-CONSIG-REVISAO-001')).toBe(false);
    expect(r.proximaMelhorAcao?.acao).toContain('contrato contestado');
  });

  it('juros abusivos ⇒ estratégia de encargos, com prioridade própria', () => {
    const r = raciocinar({ problema_principal: 'juros_abusivos' }, ESTRATEGIAS_CONSIGNADO_INSS);
    expect(r.hipotesePrincipal?.ref).toBe('EST-CONSIG-JUROS-001');
    expect(r.prioridades[0]?.acao).toContain('teto vigente');
  });

  it('MENOS fatos ⇒ MENOS confiança (mesma hipótese, confiança média, sem risco de bancos)', () => {
    const r = raciocinar(
      { problema_principal: 'descontos_nao_reconhecidos', beneficio: 'pensao' },
      ESTRATEGIAS_CONSIGNADO_INSS,
    );
    expect(r.hipotesePrincipal?.ref).toBe('EST-CONSIG-REVISAO-001');
    expect(r.hipotesePrincipal?.confianca).toBe('media'); // sem reforços suficientes
    expect(r.riscos.some((x) => x.risco.includes('múltiplas instituições'))).toBe(false);
  });
});

describe('Strategic Reasoning · nunca inventa; motor genérico', () => {
  it('SEM fatos sustentadores ⇒ NENHUMA hipótese, nenhuma ação (jamais inventado)', () => {
    const r = raciocinar({ beneficio: 'aposentadoria' }, ESTRATEGIAS_CONSIGNADO_INSS);
    expect(r.hipoteses).toEqual([]);
    expect(r.hipotesePrincipal).toBeNull();
    expect(r.proximaMelhorAcao).toBeNull();
    expect(r.prioridades).toEqual([]);
  });

  it('fatosEstrategicos: Truth Layer ⊕ Knowledge ⊕ documentos num só formato', () => {
    const fatos = fatosEstrategicos({
      truthFacts: { caseExists: true, casePhase: 'abertura' },
      conhecimento: [{ factKey: 'beneficio', valor: 'aposentadoria', origem: 'resposta', confianca: 'alta' }],
      documentosRecebidos: ['HISCON'],
    });
    expect(fatos['caseExists']).toBe(true);
    expect(fatos['beneficio']).toBe('aposentadoria');
    expect(fatos['documentos_recebidos']).toBe(1);
    expect(fatos['doc_hiscon']).toBe(true);
  });

  it('o domínio muda, o raciocínio não: catálogo alternativo raciocina igual', () => {
    const catalogoBusiness: CatalogoDeEstrategias = [
      {
        ref: 'EST-BIZ-FLUXO-001',
        hipotese: 'Problema de fluxo de caixa',
        requer: [{ fact: 'problema', op: 'eq', value: 'caixa_apertado' }],
        reforca: [{ fact: 'porte', op: 'eq', value: 'pequena' }],
        proximaAcao: 'Levantar contas a pagar/receber de 90 dias',
        fundamento: 'prática de gestão financeira',
      },
    ];
    const r = raciocinar({ problema: 'caixa_apertado', porte: 'pequena' }, catalogoBusiness);
    expect(r.hipotesePrincipal?.ref).toBe('EST-BIZ-FLUXO-001');
    expect(r.hipotesePrincipal?.sustentadaPor).toEqual(['problema=caixa_apertado']);
    // E os fatos de Business não acionam NADA no catálogo consignado:
    expect(raciocinar({ problema: 'caixa_apertado' }, ESTRATEGIAS_CONSIGNADO_INSS).hipoteses).toEqual([]);
  });
});
