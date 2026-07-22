// ─────────────────────────────────────────────────────────────────────────────
// COMMAND CENTER (GO-LIVE 13A) — testes: o briefing é DINÂMICO (a AHRI decide o
// que mostrar a partir do estado real), ranqueado por severidade, com FONTE em
// todo insight, estado vazio elegante e nada inventado. Muda quando o estado muda.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { gerarBriefing, indicadoresExecutivos, type BriefingInputs } from './index.js';

const MANHA = new Date('2026-07-19T09:00:00');

function inputs(over: Partial<BriefingInputs> = {}): BriefingInputs {
  return {
    founderName: 'Jessé',
    now: MANHA,
    clientesAtivos: 40,
    novosClientesHoje: 0,
    dossiesProntos: 0,
    aguardandoDocumentos: 0,
    aguardandoAdvogado: 0,
    casosCriticos: 0,
    casosPorAdvogado: {},
    limiteCargaAdvogado: 10,
    confiancaMediaCatalogo: null,
    confiancaMediaAnterior: null,
    taxaAcerto: null,
    estrategiaEmAlta: null,
    gargalo: null,
    ...over,
  };
}

describe('13A · o briefing dinâmico da AHRI', () => {
  it('saudação pela hora + resumo com a contagem de fatos', () => {
    const b = gerarBriefing(inputs({ novosClientesHoje: 3, casosCriticos: 1 }));
    expect(b.saudacao).toBe('Bom dia, Jessé.');
    expect(b.resumo).toContain('2 fatos');
    expect(b.geradoEm).toBe(MANHA);
    expect(b.fonte).toBe('read-models');
  });

  it('RANQUEIA por severidade: crítico → alerta → oportunidade → informação', () => {
    const b = gerarBriefing(
      inputs({
        casosCriticos: 1, // crítico
        aguardandoDocumentos: 5, // alerta
        dossiesProntos: 2, // oportunidade
        novosClientesHoje: 3, // informação
      }),
    );
    expect(b.insights.map((i) => i.severidade)).toEqual([
      'critico',
      'alerta',
      'oportunidade',
      'informacao',
    ]);
    expect(b.insights[0]?.categoria).toBe('caso-critico');
  });

  it('advogado SOBRECARREGADO só aparece acima do limite (e escolhe o mais carregado)', () => {
    const semSobrecarga = gerarBriefing(
      inputs({ casosPorAdvogado: { ana: 8, bruno: 5 }, limiteCargaAdvogado: 10 }),
    );
    expect(semSobrecarga.insights.some((i) => i.categoria === 'advogado-sobrecarregado')).toBe(
      false,
    );

    const comSobrecarga = gerarBriefing(
      inputs({ casosPorAdvogado: { ana: 14, bruno: 11 }, limiteCargaAdvogado: 10 }),
    );
    const insight = comSobrecarga.insights.find((i) => i.categoria === 'advogado-sobrecarregado');
    expect(insight?.detalhe).toContain('ana'); // o mais carregado
    expect(insight?.valor).toBe(14);
  });

  it('novo PADRÃO jurídico só a partir de 3 usos recentes (recomendação)', () => {
    expect(
      gerarBriefing(
        inputs({ estrategiaEmAlta: { ref: 'EST-CONSIG-CARTAO-RMC-001', usos: 2 } }),
      ).insights.some((i) => i.categoria === 'padrao-detectado'),
    ).toBe(false);
    const b = gerarBriefing(
      inputs({ estrategiaEmAlta: { ref: 'EST-CONSIG-CARTAO-RMC-001', usos: 5 } }),
    );
    expect(b.insights.find((i) => i.categoria === 'padrao-detectado')?.titulo).toContain('RMC');
  });

  it('confiança do catálogo SUBIU vira oportunidade com o delta', () => {
    const b = gerarBriefing(inputs({ confiancaMediaCatalogo: 0.72, confiancaMediaAnterior: 0.6 }));
    const i = b.insights.find((x) => x.categoria === 'confianca-catalogo');
    expect(i?.titulo).toContain('72%');
    expect(i?.detalhe).toContain('60%');
  });

  it('precisão baixa (<70%) vira ALERTA', () => {
    const b = gerarBriefing(inputs({ taxaAcerto: 0.5 }));
    expect(b.insights.find((i) => i.categoria === 'precisao-decisoes')?.severidade).toBe('alerta');
  });

  it('TODO insight carrega FONTE e um ponto de entrada — nada inventado', () => {
    const b = gerarBriefing(inputs({ casosCriticos: 2, dossiesProntos: 1, novosClientesHoje: 4 }));
    expect(b.insights.length).toBeGreaterThan(0);
    for (const i of b.insights) {
      expect(i.fonte.startsWith('read-model')).toBe(true);
      expect(i.href).not.toBeNull();
    }
  });

  it('ESTADO VAZIO elegante quando não há nada relevante', () => {
    const b = gerarBriefing(inputs({}));
    expect(b.insights).toEqual([]);
    expect(b.totalInsights).toBe(0);
    expect(b.resumo).toContain('tudo tranquilo');
  });

  it('DINÂMICO: estados diferentes ⇒ briefings diferentes (nunca igual dois dias)', () => {
    const hoje = gerarBriefing(inputs({ casosCriticos: 1, novosClientesHoje: 3 }));
    const amanha = gerarBriefing(inputs({ dossiesProntos: 10, aguardandoAdvogado: 2 }));
    expect(hoje.insights.map((i) => i.id)).not.toEqual(amanha.insights.map((i) => i.id));
  });

  it('saudação muda pela hora do dia', () => {
    expect(gerarBriefing(inputs({ now: new Date('2026-07-19T15:00:00') })).saudacao).toBe(
      'Boa tarde, Jessé.',
    );
    expect(gerarBriefing(inputs({ now: new Date('2026-07-19T21:00:00') })).saudacao).toBe(
      'Boa noite, Jessé.',
    );
  });
});

describe('13A · indicadores executivos (negócio, não técnico)', () => {
  const base = {
    clientesAtivos: 40,
    novosClientesHoje: 3,
    dossiesGerados: 12,
    casosDistribuidos: 20,
    aguardandoDocumentos: 4,
    casosCriticos: 1,
    tempoMedioAteDecisaoMs: 3_600_000,
    precisaoDecisoes: 0.85,
    confiancaMediaIA: 0.7,
    documentosProcessados: 130,
    valorRecuperavel: 250000,
    receitaPrevista: 50000,
  };

  it('traduz Read Models em indicadores apresentáveis, com fonte', () => {
    const ind = indicadoresExecutivos(base);
    const byId = Object.fromEntries(ind.map((i) => [i.id, i]));
    expect(byId['precisao']?.valor).toBe('85%');
    expect(byId['precisao']?.tom).toBe('positivo');
    expect(byId['criticos']?.tom).toBe('critico');
    expect(byId['valor-recuperavel']?.valor).toContain('R$');
    for (const i of ind) expect(i.fonte.startsWith('read-model')).toBe(true);
  });

  it('valores ausentes viram estado explícito (—), nunca inventados', () => {
    const ind = indicadoresExecutivos({
      ...base,
      precisaoDecisoes: null,
      valorRecuperavel: null,
      receitaPrevista: null,
      confiancaMediaIA: null,
      tempoMedioAteDecisaoMs: null,
    });
    const byId = Object.fromEntries(ind.map((i) => [i.id, i]));
    expect(byId['precisao']?.valor).toBe('—');
    expect(byId['valor-recuperavel']?.valor).toBe('—');
    expect(byId['tempo-decisao']?.valor).toBe('—');
  });
});
