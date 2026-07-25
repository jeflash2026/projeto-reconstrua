import { describe, it, expect } from 'vitest';
import { analisarFluxoFinanceiro } from './fluxo-financeiro.js';

const base = {
  valorContratoHiscon: 8000,
  parcelasHiscon: 48,
  valorParcelaHiscon: 200,
  valorContratoDeclarado: null,
  valorCreditado: null,
  dataCredito: null,
  contaDestinataria: null,
  titularidade: null,
  valorRefinanciado: null,
  valorQuitacao: null,
  trocoLiberado: null,
};

describe('Fluxo financeiro — compara sem concluir fraude', () => {
  it('valor do contrato coincidente ⇒ COINCIDE, sem divergência', () => {
    const r = analisarFluxoFinanceiro({ ...base, valorContratoDeclarado: 8000 });
    expect(r.itens.find((i) => i.campo === 'Valor do contrato')?.status).toBe('COINCIDE');
    expect(r.divergencias).toBe(0);
  });
  it('valor divergente ⇒ DIVERGE (fato técnico), nunca conclusão de fraude', () => {
    const r = analisarFluxoFinanceiro({ ...base, valorContratoDeclarado: 9500 });
    expect(r.itens.find((i) => i.campo === 'Valor do contrato')?.status).toBe('DIVERGE');
    expect(r.divergencias).toBe(1);
    expect(r.observacao.toLowerCase()).toContain('não constitui, por si, comprovação automática');
  });
  it('lado do banco ausente ⇒ NAO_APRESENTADO (nunca inventa o valor)', () => {
    const r = analisarFluxoFinanceiro(base);
    expect(r.itens.find((i) => i.campo === 'Valor do contrato')?.status).toBe('NAO_APRESENTADO');
    expect(r.itens.find((i) => i.campo === 'Valor do contrato')?.documento).toContain(
      'NÃO APRESENTADO',
    );
  });
});
