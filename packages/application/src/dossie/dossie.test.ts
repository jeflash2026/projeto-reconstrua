// ─────────────────────────────────────────────────────────────────────────────
// DOSSIÊ JURÍDICO (GO-LIVE 13A) — testes: o parecer inicial da AHRI é montado dos
// Read Models + o motor existente, com ranking de teses, evidências encontradas/
// ausentes, documentos pendentes, próximas ações, riscos, rastreabilidade
// (decisionId/strategyRef/correlationId/mission/catálogo) e a explicação
// AUDITÁVEL "Como a AHRI chegou" — sem Chain of Thought, nada inventado.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { FatoAprendido } from '../conversation/conversation-knowledge.js';
import { montarDossie, type DossieInputs } from './dossie.js';

function fato(factKey: string, valor: string): FatoAprendido {
  return { factKey, valor, origem: 'resposta do cliente', confianca: 'alta' };
}

function inputs(conhecimento: readonly FatoAprendido[], over: Partial<DossieInputs> = {}): DossieInputs {
  return {
    clienteId: 'CLI-1', chatId: '5511999@c', missionId: 'M-1', decisionId: null, correlationId: 'corr-1',
    versaoCatalogo: '11A', geradoEm: new Date('2026-07-19T12:00:00Z'),
    entradas: { conhecimento, documentosRecebidos: [] },
    documentosReconhecidos: [], contratosEncontrados: [],
    timeline: [{ rotulo: 'Cliente iniciou conversa', em: new Date('2026-07-18T10:00:00Z'), fonte: 'read-model:conversation' }],
    ...over,
  };
}

describe('13A · Dossiê Jurídico — o parecer inicial da AHRI', () => {
  // Cliente do decreto: descontos não reconhecidos + aposentadoria + hiscon + 2 anos + múltiplos bancos.
  const rmcConhecimento = [
    fato('problema_principal', 'descontos_nao_reconhecidos'), fato('beneficio', 'aposentadoria'),
    fato('tempo_do_problema', 'mais_de_2_anos'), fato('documentacao_mencionada', 'hiscon'), fato('multiplos_bancos', 'true'),
  ];

  it('produz resumo executivo, tese principal ranqueada e grau de confiança', () => {
    const d = montarDossie(inputs(rmcConhecimento, { documentosReconhecidos: ['HISCON'] }));
    expect(d.resumoExecutivo).toContain('revisão contratual');
    expect(d.grauConfianca).toBe('alta');
    expect(d.hipoteses[0]).toMatchObject({ posicao: 1, ref: 'EST-CONSIG-REVISAO-001', confianca: 'alta' });
    expect(d.hipoteses[0]?.justificativa).toContain('problema_principal=descontos_nao_reconhecidos');
    expect(d.hipoteses[0]?.fundamento).toContain('Lei 10.820');
  });

  it('evidências encontradas × ausentes, documentos reconhecidos × pendentes', () => {
    const d = montarDossie(inputs(
      [fato('problema_principal', 'descontos_nao_reconhecidos'), fato('beneficio', 'aposentadoria')],
      { documentosReconhecidos: [] },
    ));
    expect(d.evidenciasEncontradas).toContain('problema_principal=descontos_nao_reconhecidos');
    // sem tempo/hiscon/bancos ⇒ reforços ausentes:
    expect(d.evidenciasAusentes).toContain('tempo_do_problema');
    expect(d.evidenciasAusentes).toContain('multiplos_bancos');
    // documento esperado (HISCON) não reconhecido ⇒ pendente:
    expect(d.documentosPendentes.some((x) => x.includes('HISCON'))).toBe(true);
  });

  it('próximas ações e riscos vêm do motor (não da interface)', () => {
    const d = montarDossie(inputs(rmcConhecimento, { documentosReconhecidos: ['HISCON'] }));
    expect(d.proximasAcoes.some((a) => a.includes('Validar documentação complementar'))).toBe(true);
    expect(d.riscos.some((r) => r.includes('múltiplas instituições'))).toBe(true);
    expect(d.observacoesIA.length).toBeGreaterThan(0);
  });

  it('RASTREABILIDADE completa no cabeçalho', () => {
    const d = montarDossie(inputs(rmcConhecimento));
    expect(d.strategyRef).toBe('EST-CONSIG-REVISAO-001');
    expect(d.decisionId).toMatch(/^dec-[0-9a-f]{8}$/); // derivado do Executive Mind
    expect(d.correlationId).toBe('corr-1');
    expect(d.missionId).toBe('M-1');
    expect(d.versaoCatalogo).toBe('11A');
    expect(d.timeline[0]?.rotulo).toBe('Cliente iniciou conversa');
  });

  it('"Como a AHRI chegou" — auditável: fatos, docs, avaliadas, descartadas, vencedora', () => {
    // Cenário com DUAS teses para haver descarte: RMC (com reforços) vs. nada mais.
    const d = montarDossie(inputs([
      fato('problema_principal', 'cartao_rmc'), fato('beneficio', 'aposentadoria'),
      fato('tempo_do_problema', 'mais_de_2_anos'), fato('multiplos_bancos', 'true'),
    ], { documentosReconhecidos: [] }));
    const e = d.explicacao;
    expect(e.estrategiaVencedora).toBe('EST-CONSIG-CARTAO-RMC-001');
    expect(e.confianca).toBe('alta');
    expect(e.fatosUtilizados).toContain('problema_principal=cartao_rmc');
    expect(e.hipotesesAvaliadas.some((h) => h.ref === 'EST-CONSIG-CARTAO-RMC-001')).toBe(true);
    expect(e.criterios).toContain('confiança');
    // Nunca há campo de "raciocínio interno" — apenas dados auditáveis.
    expect(Object.keys(e)).not.toContain('chainOfThought');
  });

  it('ESTADO VAZIO elegante: sem evidências suficientes, nenhuma tese inventada', () => {
    const d = montarDossie(inputs([fato('beneficio', 'aposentadoria')])); // sem problema_principal
    expect(d.hipoteses).toEqual([]);
    expect(d.grauConfianca).toBeNull();
    expect(d.resumoExecutivo).toContain('Ainda não há evidências suficientes');
    expect(d.explicacao.estrategiaVencedora).toBeNull();
  });
});
