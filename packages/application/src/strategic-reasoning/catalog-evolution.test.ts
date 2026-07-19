// ─────────────────────────────────────────────────────────────────────────────
// CATALOG EVOLUTION (GO-LIVE 11B) — testes: o relatório MEDE o catálogo a partir
// de atendimentos encerrados (mais usadas, nunca usadas, corrigidas, documentos
// que faltam, fatos difíceis, confiança média, tempo até decisão) e JAMAIS
// altera o catálogo — só relata para o arquiteto.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ESTRATEGIAS_CONSIGNADO_INSS } from './consignado-strategies.js';
import { gerarRelatorioDeEvolucao, type AtendimentoEncerrado } from './catalog-evolution.js';

function atendimento(over: Partial<AtendimentoEncerrado>): AtendimentoEncerrado {
  return {
    ref: 'A', estrategiaEscolhida: 'EST-CONSIG-REVISAO-001', confianca: 'alta',
    documentosRecebidos: ['HISCON'], decisaoAdvogado: 'confirmada',
    estrategiaCorreta: null, estrategiaIncorreta: null, documentosFaltantes: [],
    motivoCorrecao: null, fatosDificeis: [], tempoAteDecisaoMs: 60_000,
    ...over,
  };
}

/** Uma bateria realista de atendimentos encerrados do consignado. */
const ATENDIMENTOS: readonly AtendimentoEncerrado[] = [
  atendimento({ ref: 'A1', estrategiaEscolhida: 'EST-CONSIG-REVISAO-001', confianca: 'alta', decisaoAdvogado: 'confirmada', tempoAteDecisaoMs: 40_000 }),
  atendimento({ ref: 'A2', estrategiaEscolhida: 'EST-CONSIG-REVISAO-001', confianca: 'media', decisaoAdvogado: 'confirmada', documentosFaltantes: ['extrato de empréstimos consignados do INSS'], fatosDificeis: ['multiplos_bancos'], tempoAteDecisaoMs: 80_000 }),
  atendimento({ ref: 'A3', estrategiaEscolhida: 'EST-CONSIG-REVISAO-001', confianca: 'media', decisaoAdvogado: 'corrigida', estrategiaIncorreta: 'EST-CONSIG-REVISAO-001', estrategiaCorreta: 'EST-CONSIG-CARTAO-RMC-001', motivoCorrecao: 'era cartão RMC, não empréstimo comum', documentosFaltantes: ['extrato da RMC / cartão consignado'], fatosDificeis: ['problema_principal'], tempoAteDecisaoMs: 120_000 }),
  atendimento({ ref: 'A4', estrategiaEscolhida: 'EST-CONSIG-JUROS-001', confianca: 'media', decisaoAdvogado: 'confirmada', tempoAteDecisaoMs: 60_000 }),
  atendimento({ ref: 'A5', estrategiaEscolhida: 'EST-CONSIG-JUROS-001', confianca: 'media', decisaoAdvogado: 'corrigida', estrategiaIncorreta: 'EST-CONSIG-JUROS-001', estrategiaCorreta: 'EST-CONSIG-TARIFAS-001', motivoCorrecao: 'eram tarifas embutidas, não juros', documentosFaltantes: ['contrato com discriminação de tarifas/seguros', 'extrato da RMC / cartão consignado'], fatosDificeis: ['problema_principal'], tempoAteDecisaoMs: 100_000 }),
];

describe('11B · o relatório mede o catálogo (não o altera)', () => {
  const rel = gerarRelatorioDeEvolucao(ESTRATEGIAS_CONSIGNADO_INSS, ATENDIMENTOS);

  it('estratégias MAIS utilizadas (desc) e total de atendimentos', () => {
    expect(rel.totalAtendimentos).toBe(5);
    expect(rel.estrategiasMaisUtilizadas[0]).toEqual({ chave: 'EST-CONSIG-REVISAO-001', ocorrencias: 3 });
    expect(rel.estrategiasMaisUtilizadas[1]).toEqual({ chave: 'EST-CONSIG-JUROS-001', ocorrencias: 2 });
  });

  it('estratégias NUNCA utilizadas = catálogo menos as escolhidas', () => {
    expect(rel.estrategiasNuncaUtilizadas).toContain('EST-CONSIG-CARTAO-RMC-001'); // foi correta, nunca escolhida
    expect(rel.estrategiasNuncaUtilizadas).toContain('EST-CONSIG-SUPERENDIVIDAMENTO-001');
    expect(rel.estrategiasNuncaUtilizadas).not.toContain('EST-CONSIG-REVISAO-001');
  });

  it('estratégias frequentemente CORRIGIDAS (a que estava errada), com taxa', () => {
    const corr = Object.fromEntries(rel.estrategiasFrequentementeCorrigidas.map((c) => [c.ref, c]));
    expect(corr['EST-CONSIG-REVISAO-001']?.correcoes).toBe(1);
    expect(corr['EST-CONSIG-REVISAO-001']?.usos).toBe(3);
    expect(corr['EST-CONSIG-REVISAO-001']?.taxaCorrecao).toBeCloseTo(0.333, 2);
    expect(corr['EST-CONSIG-JUROS-001']?.taxaCorrecao).toBeCloseTo(0.5, 2);
  });

  it('documentos que MAIS faltam (desc)', () => {
    expect(rel.documentosQueMaisFaltam[0]).toEqual({ chave: 'extrato da RMC / cartão consignado', ocorrencias: 2 });
  });

  it('fatos mais DIFÍCEIS de descobrir (desc)', () => {
    expect(rel.fatosMaisDificeis[0]).toEqual({ chave: 'problema_principal', ocorrencias: 2 });
    expect(rel.fatosMaisDificeis.some((f) => f.chave === 'multiplos_bancos')).toBe(true);
  });

  it('confiança média (0..1) + distribuição, e tempo médio até decisão', () => {
    // 1 alta + 4 media ⇒ (1 + 0.5*4)/5 = 0.6
    expect(rel.confiancaMedia).toBeCloseTo(0.6, 3);
    expect(rel.confiancaDistribuicao).toEqual({ alta: 1, media: 4, baixa: 0 });
    // (40+80+120+60+100)/5 mil = 80.000ms
    expect(rel.tempoMedioAteDecisaoMs).toBe(80_000);
  });

  it('taxa de acerto = confirmadas / total (3/5)', () => {
    expect(rel.taxaAcerto).toBeCloseTo(0.6, 3);
  });

  it('NUNCA altera o catálogo — a mesma referência permanece intacta', () => {
    const antes = ESTRATEGIAS_CONSIGNADO_INSS.length;
    gerarRelatorioDeEvolucao(ESTRATEGIAS_CONSIGNADO_INSS, ATENDIMENTOS);
    expect(ESTRATEGIAS_CONSIGNADO_INSS.length).toBe(antes);
    expect(ESTRATEGIAS_CONSIGNADO_INSS[0]?.ref).toBe('EST-CONSIG-REVISAO-001');
  });
});

describe('11B · bordas', () => {
  it('sem atendimentos ⇒ relatório zerado; todas as estratégias nunca utilizadas', () => {
    const rel = gerarRelatorioDeEvolucao(ESTRATEGIAS_CONSIGNADO_INSS, []);
    expect(rel.totalAtendimentos).toBe(0);
    expect(rel.confiancaMedia).toBe(0);
    expect(rel.tempoMedioAteDecisaoMs).toBe(0);
    expect(rel.taxaAcerto).toBe(0);
    expect(rel.estrategiasNuncaUtilizadas).toHaveLength(ESTRATEGIAS_CONSIGNADO_INSS.length);
  });

  it('rejeição também conta como correção da estratégia escolhida', () => {
    const rel = gerarRelatorioDeEvolucao(ESTRATEGIAS_CONSIGNADO_INSS, [
      atendimento({ ref: 'R1', estrategiaEscolhida: 'EST-CONSIG-MARGEM-001', decisaoAdvogado: 'rejeitada', estrategiaIncorreta: null }),
    ]);
    expect(rel.estrategiasFrequentementeCorrigidas[0]).toMatchObject({ ref: 'EST-CONSIG-MARGEM-001', correcoes: 1 });
    expect(rel.taxaAcerto).toBe(0);
  });
});
