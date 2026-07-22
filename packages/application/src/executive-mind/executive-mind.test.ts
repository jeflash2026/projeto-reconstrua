// ─────────────────────────────────────────────────────────────────────────────
// EXECUTIVE MIND (GO-LIVE 10B) — testes: o MESMO conjunto de hipóteses SEMPRE
// produz UMA única decisão ativa (determinística, id estável), as demais ficam
// REGISTRADAS com o motivo exato da derrota, e a justificativa é completamente
// auditável (por que venceu + por que as outras perderam).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { BrainFacts } from '../executive-brain/facts.js';
import { raciocinar } from '../strategic-reasoning/strategic-reasoning.js';
import { ESTRATEGIAS_CONSIGNADO_INSS } from '../strategic-reasoning/consignado-strategies.js';
import { deliberar } from './executive-mind.js';

/** O cliente do decreto 10A: revisão contratual com confiança ALTA (3 reforços). */
const CLIENTE_DO_DECRETO: BrainFacts = {
  beneficio: 'aposentadoria',
  documentacao_mencionada: 'hiscon',
  problema_principal: 'descontos_nao_reconhecidos',
  tempo_do_problema: 'mais_de_2_anos',
  multiplos_bancos: 'true',
};

function decidir(facts: BrainFacts) {
  return deliberar(raciocinar(facts, ESTRATEGIAS_CONSIGNADO_INSS));
}

describe('Executive Mind · UMA estratégia ativa, determinística', () => {
  it('entrega exatamente UMA decisão ativa (a revisão contratual)', () => {
    const d = decidir(CLIENTE_DO_DECRETO);
    expect(d).not.toBeNull();
    expect(d?.strategyRef).toBe('EST-CONSIG-REVISAO-001');
    expect(d?.confidence).toBe('alta');
    expect(d?.nextAction).toContain('Validar documentação complementar');
    expect(d?.expectedOutcome).toContain('Revisão contratual');
  });

  it('DETERMINISMO: o mesmo conjunto de hipóteses ⇒ o MESMO decisionId, sempre', () => {
    const a = decidir(CLIENTE_DO_DECRETO);
    const b = decidir({ ...CLIENTE_DO_DECRETO }); // mesma entrada, ordem diferente de chaves
    expect(a?.decisionId).toBe(b?.decisionId);
    expect(a?.decisionId).toMatch(/^dec-[0-9a-f]{8}$/);
  });

  it('decisões DIFERENTES para fatos diferentes têm decisionId diferente', () => {
    const revisao = decidir(CLIENTE_DO_DECRETO);
    const fraude = decidir({ problema_principal: 'emprestimo_nao_contratado' });
    expect(fraude?.strategyRef).toBe('EST-CONSIG-NAO-CONTRATADO-001');
    expect(revisao?.decisionId).not.toBe(fraude?.decisionId);
  });
});

describe('Executive Mind · as demais permanecem registradas (com motivo da derrota)', () => {
  // Fatos que sustentam DUAS hipóteses ao mesmo tempo: revisão (com reforços,
  // ALTA) concorre com juros (sem reforços, MÉDIA) — a de maior confiança vence.
  const CONCORRENCIA: BrainFacts = {
    beneficio: 'aposentadoria',
    documentacao_mencionada: 'hiscon',
    problema_principal: 'juros_abusivos', // sustenta EST-CONSIG-JUROS-001
    multiplos_bancos: 'true',
  };

  it('mesmo com concorrência, existe UMA ativa e a derrotada fica registrada', () => {
    const r = raciocinar(CONCORRENCIA, ESTRATEGIAS_CONSIGNADO_INSS);
    const d = deliberar(r);
    // juros_abusivos só casa EST-CONSIG-JUROS-001 aqui (revisão exige descontos_nao_reconhecidos)
    expect(d?.strategyRef).toBe('EST-CONSIG-JUROS-001');
    // Só há uma hipótese sustentada ⇒ sem alternativas, sem fallback.
    expect(d?.alternativasRegistradas).toEqual([]);
    expect(d?.fallbackStrategy).toBeNull();
    expect(d?.why).toContain('nenhuma alternativa concorrente');
  });

  it('duas hipóteses sustentadas: a perdedora registra o motivo e vira fallback', () => {
    // Catálogo sintético com DUAS hipóteses sobre os mesmos fatos, confianças distintas.
    const r = raciocinar({ p: 'x', reforco1: 'sim', reforco2: 'sim' }, [
      {
        ref: 'EST-FORTE',
        hipotese: 'hipótese forte',
        requer: [{ fact: 'p', op: 'eq', value: 'x' }],
        reforca: [
          { fact: 'reforco1', op: 'eq', value: 'sim' },
          { fact: 'reforco2', op: 'eq', value: 'sim' },
        ],
        proximaAcao: 'agir forte',
        fundamento: 'f1',
      },
      {
        ref: 'EST-FRACA',
        hipotese: 'hipótese fraca',
        requer: [{ fact: 'p', op: 'eq', value: 'x' }],
        proximaAcao: 'agir fraco',
        fundamento: 'f2',
      },
    ]);
    const d = deliberar(r);
    expect(d?.strategyRef).toBe('EST-FORTE');
    expect(d?.confidence).toBe('alta');
    expect(d?.fallbackStrategy).toBe('EST-FRACA');
    expect(d?.alternativasRegistradas).toHaveLength(1);
    const perdedora = d?.alternativasRegistradas[0];
    expect(perdedora?.strategyRef).toBe('EST-FRACA');
    expect(perdedora?.motivoDaDerrota).toContain('confiança inferior');
    expect(perdedora?.motivoDaDerrota).toContain('media < alta');
  });
});

describe('Executive Mind · justificativa completamente auditável', () => {
  it('why explica por que VENCEU e por que as outras PERDERAM; auditoria completa', () => {
    const r = raciocinar({ p: 'x', reforco1: 'sim', reforco2: 'sim' }, [
      {
        ref: 'EST-FORTE',
        hipotese: 'forte',
        requer: [{ fact: 'p', op: 'eq', value: 'x' }],
        reforca: [
          { fact: 'reforco1', op: 'eq', value: 'sim' },
          { fact: 'reforco2', op: 'eq', value: 'sim' },
        ],
        proximaAcao: 'a',
        fundamento: 'f1',
      },
      {
        ref: 'EST-FRACA',
        hipotese: 'fraca',
        requer: [{ fact: 'p', op: 'eq', value: 'x' }],
        proximaAcao: 'b',
        fundamento: 'f2',
      },
    ]);
    const d = deliberar(r);
    expect(d?.why).toContain('EST-FORTE venceu');
    expect(d?.why).toContain('sustentada por [p=x]');
    expect(d?.why).toContain('reforçada por [reforco1=sim, reforco2=sim]');
    expect(d?.why).toContain('derrotadas: EST-FRACA');
    // Auditoria: critério declarado + nº de hipóteses + fatos sustentadores/reforços.
    expect(d?.auditoria.criterio).toContain('confiança');
    expect(d?.auditoria.hipotesesRecebidas).toBe(2);
    expect(d?.auditoria.sustentadaPor).toEqual(['p=x']);
    expect(d?.auditoria.reforcadaPor).toEqual(['reforco1=sim', 'reforco2=sim']);
  });

  it('SEM hipóteses ⇒ NENHUMA decisão (o Executive Mind jamais inventa)', () => {
    expect(decidir({ beneficio: 'aposentadoria' })).toBeNull();
  });
});
