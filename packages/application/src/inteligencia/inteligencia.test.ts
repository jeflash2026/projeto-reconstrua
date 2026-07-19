// ─────────────────────────────────────────────────────────────────────────────
// INTELIGÊNCIA (GO-LIVE 13A) — testes: a biblioteca de estratégias traduz o
// catálogo em cartões legíveis com estatísticas de uso; as hipóteses saem do
// dossiê com "Como a AHRI chegou" (auditável); o conhecimento é agrupado por
// categoria (só fatos, nunca mensagens). Tudo dos Read Models; nada inventado.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ESTRATEGIAS_CONSIGNADO_INSS } from '../strategic-reasoning/consignado-strategies.js';
import type { AtendimentoEncerrado } from '../strategic-reasoning/catalog-evolution.js';
import { montarDossie } from '../dossie/dossie.js';
import type { FatoAprendido } from '../conversation/conversation-knowledge.js';
import {
  agregarConhecimento,
  descreverCondicao,
  estatisticasPorEstrategia,
  hipotesesDoDossie,
  montarBibliotecaEstrategias,
} from './inteligencia.js';

function atend(over: Partial<AtendimentoEncerrado>): AtendimentoEncerrado {
  return {
    ref: 'M-1', estrategiaEscolhida: 'EST-CONSIG-REVISAO-001', confianca: 'alta', documentosRecebidos: [],
    decisaoAdvogado: 'confirmada', estrategiaCorreta: null, estrategiaIncorreta: null, documentosFaltantes: [],
    motivoCorrecao: null, fatosDificeis: [], tempoAteDecisaoMs: 60000,
    auditoria: { missionId: 'M-1', decisionId: null, correlationId: 'c', cliente: 'x', data: new Date('2026-07-10'), advogado: 'ana' },
    ...over,
  };
}

describe('13A · Inteligência — biblioteca de estratégias', () => {
  it('traduz condições em texto legível', () => {
    expect(descreverCondicao({ fact: 'problema_principal', op: 'eq', value: 'descontos_nao_reconhecidos' })).toBe('Problema principal é descontos_nao_reconhecidos');
    expect(descreverCondicao({ fact: 'beneficio', op: 'in', value: ['aposentadoria', 'pensao'] })).toContain('Benefício ∈ {aposentadoria, pensao}');
  });

  it('cada estratégia vira um cartão com requisitos, docs, riscos, fundamento', () => {
    const lib = montarBibliotecaEstrategias(ESTRATEGIAS_CONSIGNADO_INSS, []);
    expect(lib).toHaveLength(ESTRATEGIAS_CONSIGNADO_INSS.length);
    const revisao = lib.find((s) => s.ref === 'EST-CONSIG-REVISAO-001');
    expect(revisao?.requisitosMinimos.length).toBeGreaterThan(0);
    expect(revisao?.documentosEsperados).toContain('HISCON');
    expect(revisao?.criteriosDeExclusao.length).toBeGreaterThan(0);
    expect(revisao?.fundamento).toContain('Lei 10.820');
    expect(revisao?.usos).toBe(0); // sem atendimentos ainda
  });

  it('estatísticas por estratégia: usos, correções, taxa de acerto, confiança, última utilização', () => {
    const stats = estatisticasPorEstrategia([
      atend({ ref: 'M-1', decisaoAdvogado: 'confirmada', confianca: 'alta', auditoria: { missionId: 'M-1', decisionId: null, correlationId: 'c', cliente: 'x', data: new Date('2026-07-10'), advogado: 'ana' } }),
      atend({ ref: 'M-2', decisaoAdvogado: 'corrigida', estrategiaIncorreta: 'EST-CONSIG-REVISAO-001', confianca: 'media', auditoria: { missionId: 'M-2', decisionId: null, correlationId: 'c', cliente: 'y', data: new Date('2026-07-12'), advogado: 'ana' } }),
    ]);
    const s = stats.get('EST-CONSIG-REVISAO-001');
    expect(s?.usos).toBe(2);
    expect(s?.correcoes).toBe(1);
    expect(s?.taxaAcerto).toBeCloseTo(0.5, 2);
    expect(s?.ultimaUtilizacao).toEqual(new Date('2026-07-12'));
    const lib = montarBibliotecaEstrategias(ESTRATEGIAS_CONSIGNADO_INSS, [atend({})]);
    expect(lib.find((x) => x.ref === 'EST-CONSIG-REVISAO-001')?.usos).toBe(1);
  });
});

describe('13A · Inteligência — hipóteses produzidas', () => {
  function fato(k: string, v: string): FatoAprendido {
    return { factKey: k, valor: v, origem: 'resposta', confianca: 'alta' };
  }
  const dossie = montarDossie({
    clienteId: 'CLI-1', chatId: 'CLI-1', missionId: 'M-1', decisionId: null, correlationId: 'corr-1',
    versaoCatalogo: '11A', geradoEm: new Date('2026-07-19T12:00:00Z'),
    entradas: { conhecimento: [fato('problema_principal', 'descontos_nao_reconhecidos'), fato('beneficio', 'aposentadoria')], documentosRecebidos: ['HISCON'] },
    documentosReconhecidos: ['HISCON'], contratosEncontrados: [], timeline: [],
  });

  it('extrai as hipóteses com status vencedora/avaliada + explicação auditável', () => {
    const views = hipotesesDoDossie(dossie, 'João');
    expect(views.length).toBeGreaterThan(0);
    const principal = views[0];
    expect(principal?.clienteNome).toBe('João');
    expect(principal?.estrategiaRef).toBe('EST-CONSIG-REVISAO-001');
    expect(principal?.status).toBe('vencedora');
    expect(principal?.fatosSustentam).toContain('problema_principal=descontos_nao_reconhecidos');
    expect(principal?.explicacao.estrategiaVencedora).toBe('EST-CONSIG-REVISAO-001');
    // Sem Chain of Thought — só campos auditáveis:
    expect(Object.keys(principal?.explicacao ?? {})).not.toContain('chainOfThought');
  });
});

describe('13A · Inteligência — conhecimento aprendido (só fatos)', () => {
  it('agrupa por categoria, com origem/confiança/fonte, sem mensagens', () => {
    const grupos = agregarConhecimento([
      { clienteId: 'a', clienteNome: 'A', factKey: 'beneficio', valor: 'aposentadoria', origem: 'resposta', confianca: 'alta' },
      { clienteId: 'b', clienteNome: 'B', factKey: 'beneficio', valor: 'pensao', origem: 'resposta', confianca: 'alta' },
      { clienteId: 'a', clienteNome: 'A', factKey: 'problema_principal', valor: 'cartao_rmc', origem: 'resposta', confianca: 'alta' },
    ]);
    const beneficio = grupos.find((g) => g.factKey === 'beneficio');
    expect(beneficio?.categoria).toBe('Benefício');
    expect(beneficio?.itens).toHaveLength(2);
    expect(beneficio?.itens[0]?.fonte).toBe('read-model:conversation-knowledge');
    // ordena por quantidade (beneficio tem 2, vem antes de problema com 1)
    expect(grupos[0]?.factKey).toBe('beneficio');
  });
});
