// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION FEEDBACK LOOP (GO-LIVE 11C) — prova a INTEGRAÇÃO:
//   encerrar missão → gera AtendimentoEncerrado (auto + 3 campos humanos) →
//   persiste → o painel do arquiteto reflete IMEDIATAMENTE os novos dados.
// Auto-preenchimento, auditoria completa e não-recálculo (só lê o persistido).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ESTRATEGIAS_CONSIGNADO_INSS } from './consignado-strategies.js';
import {
  InMemoryAtendimentoStore,
  ProductionFeedbackLoop,
  montarAtendimentoEncerrado,
  montarPainelDoArquiteto,
  type EncerramentoAutomatico,
} from './production-feedback-loop.js';

function auto(over: Partial<EncerramentoAutomatico>): EncerramentoAutomatico {
  return {
    missionId: 'M-1',
    decisionId: 'dec-abc12345',
    correlationId: 'corr-1',
    cliente: '5511999@c',
    advogado: 'dra. ana',
    data: new Date(Date.UTC(2026, 6, 10)),
    strategyRef: 'EST-CONSIG-REVISAO-001',
    confianca: 'alta',
    documentosRecebidos: ['HISCON'],
    documentosFaltantes: [],
    tempoAteDecisaoMs: 60_000,
    fatosAprendidos: ['beneficio=aposentadoria'],
    ...over,
  };
}

describe('11C · o encerramento gera o AtendimentoEncerrado automaticamente', () => {
  it('auto-preenche tudo que o sistema já tem; humano fornece só 3 campos', () => {
    const a = montarAtendimentoEncerrado(
      auto({
        documentosFaltantes: ['extrato da RMC / cartão consignado'],
        fatosAprendidos: ['problema_principal=descontos_nao_reconhecidos'],
      }),
      {
        decisaoAdvogado: 'corrigida',
        estrategiaCorreta: 'EST-CONSIG-CARTAO-RMC-001',
        motivoCorrecao: 'era cartão RMC',
      },
    );
    // Automático:
    expect(a.estrategiaEscolhida).toBe('EST-CONSIG-REVISAO-001');
    expect(a.confianca).toBe('alta');
    expect(a.documentosRecebidos).toEqual(['HISCON']);
    expect(a.documentosFaltantes).toEqual(['extrato da RMC / cartão consignado']);
    expect(a.tempoAteDecisaoMs).toBe(60_000);
    expect(a.fatosAprendidos).toEqual(['problema_principal=descontos_nao_reconhecidos']);
    // Humano (corrigida) ⇒ a escolhida vira a incorreta:
    expect(a.estrategiaIncorreta).toBe('EST-CONSIG-REVISAO-001');
    expect(a.estrategiaCorreta).toBe('EST-CONSIG-CARTAO-RMC-001');
    expect(a.motivoCorrecao).toBe('era cartão RMC');
  });

  it('AUDITORIA: referencia missionId, decisionId, correlationId, cliente, data, advogado', () => {
    const a = montarAtendimentoEncerrado(auto({}), { decisaoAdvogado: 'confirmada' });
    expect(a.auditoria).toEqual({
      missionId: 'M-1',
      decisionId: 'dec-abc12345',
      correlationId: 'corr-1',
      cliente: '5511999@c',
      data: new Date(Date.UTC(2026, 6, 10)),
      advogado: 'dra. ana',
    });
    expect(a.estrategiaIncorreta).toBeNull(); // confirmada ⇒ não houve correção
  });
});

describe('11C · encerrar → persistir → o painel reflete imediatamente', () => {
  it('o laço completo alimenta o painel a cada encerramento', async () => {
    const store = new InMemoryAtendimentoStore();
    const loop = new ProductionFeedbackLoop(store);

    // Painel vazio antes de qualquer encerramento.
    const vazio = montarPainelDoArquiteto(ESTRATEGIAS_CONSIGNADO_INSS, await store.listar());
    expect(vazio.totalAtendimentos).toBe(0);

    // 1º encerramento: confirmada.
    await loop.registrarEncerramento(auto({ missionId: 'M-1', tempoAteDecisaoMs: 40_000 }), {
      decisaoAdvogado: 'confirmada',
    });
    let painel = montarPainelDoArquiteto(ESTRATEGIAS_CONSIGNADO_INSS, await store.listar());
    expect(painel.totalAtendimentos).toBe(1);
    expect(painel.taxaAcerto).toBe(1);

    // 2º encerramento: corrigida (revisão → RMC), com documento faltante.
    await loop.registrarEncerramento(
      auto({
        missionId: 'M-2',
        tempoAteDecisaoMs: 120_000,
        documentosFaltantes: ['extrato da RMC / cartão consignado'],
        fatosDificeis: ['problema_principal'],
      }),
      {
        decisaoAdvogado: 'corrigida',
        estrategiaCorreta: 'EST-CONSIG-CARTAO-RMC-001',
        motivoCorrecao: 'RMC',
      },
    );
    painel = montarPainelDoArquiteto(ESTRATEGIAS_CONSIGNADO_INSS, await store.listar());

    expect(painel.totalAtendimentos).toBe(2);
    expect(painel.taxaAcerto).toBe(0.5); // 1 de 2 confirmadas
    expect(painel.estrategiasMaisUtilizadas[0]).toEqual({
      chave: 'EST-CONSIG-REVISAO-001',
      ocorrencias: 2,
    });
    expect(painel.estrategiasMaisCorrigidas[0]).toMatchObject({
      ref: 'EST-CONSIG-REVISAO-001',
      correcoes: 1,
    });
    expect(painel.documentosMaisFaltantes[0]).toEqual({
      chave: 'extrato da RMC / cartão consignado',
      ocorrencias: 1,
    });
    expect(painel.fatosDificeis[0]).toEqual({ chave: 'problema_principal', ocorrencias: 1 });
    expect(painel.tempoMedioAteDecisaoMs).toBe(80_000);
  });

  it('HISTÓRICO MENSAL: agrupa por mês da data de auditoria', async () => {
    const store = new InMemoryAtendimentoStore();
    const loop = new ProductionFeedbackLoop(store);
    await loop.registrarEncerramento(
      auto({ missionId: 'J1', data: new Date(Date.UTC(2026, 5, 15)) }),
      { decisaoAdvogado: 'confirmada' },
    );
    await loop.registrarEncerramento(
      auto({ missionId: 'J2', data: new Date(Date.UTC(2026, 5, 20)), confianca: 'media' }),
      { decisaoAdvogado: 'corrigida', estrategiaCorreta: 'EST-CONSIG-JUROS-001' },
    );
    await loop.registrarEncerramento(
      auto({ missionId: 'L1', data: new Date(Date.UTC(2026, 6, 3)) }),
      { decisaoAdvogado: 'confirmada' },
    );

    const painel = montarPainelDoArquiteto(ESTRATEGIAS_CONSIGNADO_INSS, await store.listar());
    expect(painel.historicoMensal.map((h) => h.mes)).toEqual(['2026-06', '2026-07']);
    expect(painel.historicoMensal[0]).toMatchObject({ mes: '2026-06', total: 2, taxaAcerto: 0.5 });
    expect(painel.historicoMensal[1]).toMatchObject({ mes: '2026-07', total: 1, taxaAcerto: 1 });
  });

  it('não recalcula: o painel só reflete o que está PERSISTIDO no store', async () => {
    const store = new InMemoryAtendimentoStore();
    const loop = new ProductionFeedbackLoop(store);
    const registrado = await loop.registrarEncerramento(auto({}), {
      decisaoAdvogado: 'confirmada',
    });
    const persistidos = await store.listar();
    expect(persistidos).toHaveLength(1);
    expect(persistidos[0]).toEqual(registrado); // o registro salvo é exatamente o gerado
  });
});
