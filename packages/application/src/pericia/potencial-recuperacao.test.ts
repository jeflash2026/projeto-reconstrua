// ─────────────────────────────────────────────────────────────────────────────
// Testes do POTENCIAL DE RECUPERAÇÃO — parcelas decorridas entre competências
// (mm/aaaa), limites por fim/quantidade, contrato futuro, sem valor de parcela.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ContratoHiscon } from './hiscon-parser.js';
import { parcelasDescontadasAteHoje, potencialDeRecuperacao } from './potencial-recuperacao.js';

const HOJE = new Date('2026-07-21T12:00:00.000Z'); // competência 07/2026

function contrato(sobrescreve: Partial<ContratoHiscon>): ContratoHiscon {
  return {
    contrato: 'C-1',
    bancoCodigo: '341',
    bancoNome: 'ITAU',
    situacao: 'Ativo',
    origemAverbacao: null,
    migrado: false,
    migradoDoContrato: null,
    migradoDoCbc: null,
    modalidade: 'EMPRESTIMO',
    dataInclusao: null,
    competenciaInicio: null,
    competenciaFim: null,
    qtdeParcelas: null,
    valorParcela: null,
    valorEmprestado: null,
    valorLiberado: null,
    iof: null,
    cetMensal: null,
    cetAnual: null,
    taxaJurosMensal: null,
    taxaJurosAnual: null,
    valorPago: null,
    dataPrimeiroDesconto: null,
    ...sobrescreve,
  };
}

describe('parcelasDescontadasAteHoje', () => {
  it('início 03/2026 com qtde ⇒ 5 parcelas (a competência de início conta)', () => {
    expect(
      parcelasDescontadasAteHoje(
        contrato({ competenciaInicio: '03/2026', qtdeParcelas: 84 }),
        HOJE,
      ),
    ).toBe(5);
  });

  it('contrato ENCERRADO: fim 05/2026 limita (03..05 = 3 parcelas, não 5)', () => {
    expect(
      parcelasDescontadasAteHoje(
        contrato({ competenciaInicio: '03/2026', competenciaFim: '05/2026' }),
        HOJE,
      ),
    ).toBe(3);
  });

  it('quantidade contratada limita (84 parcelas de um contrato antigo já quitado)', () => {
    expect(
      parcelasDescontadasAteHoje(
        contrato({ competenciaInicio: '01/2015', qtdeParcelas: 84 }),
        HOJE,
      ),
    ).toBe(84);
  });

  it('GARANTIA 100% REAL: sem fim NEM quantidade ⇒ 0 (não extrapola até hoje)', () => {
    // Antes contava início→hoje (chute). Agora, sem teto confiável, não conta.
    expect(parcelasDescontadasAteHoje(contrato({ competenciaInicio: '03/2026' }), HOJE)).toBe(0);
  });

  it('desconto FUTURO (início 09/2026) ⇒ 0; competência ilegível ⇒ 0', () => {
    expect(
      parcelasDescontadasAteHoje(
        contrato({ competenciaInicio: '09/2026', qtdeParcelas: 84 }),
        HOJE,
      ),
    ).toBe(0);
    expect(
      parcelasDescontadasAteHoje(contrato({ competenciaInicio: 'xx/26', qtdeParcelas: 84 }), HOJE),
    ).toBe(0);
    expect(parcelasDescontadasAteHoje(contrato({ qtdeParcelas: 84 }), HOJE)).toBe(0);
  });

  it('sem competência de início, usa a data do PRIMEIRO DESCONTO (com teto) como fallback', () => {
    expect(
      parcelasDescontadasAteHoje(
        contrato({ dataPrimeiroDesconto: new Date('2026-05-07T00:00:00.000Z'), qtdeParcelas: 84 }),
        HOJE,
      ),
    ).toBe(3); // 05, 06, 07
  });
});

describe('potencialDeRecuperacao', () => {
  it('soma parcelas × valor por contrato; sem valor de parcela entra como 0 e é DECLARADO', () => {
    const resultado = potencialDeRecuperacao(
      [
        contrato({ competenciaInicio: '03/2026', qtdeParcelas: 84, valorParcela: 200 }), // 5 × 200 = 1000
        contrato({
          contrato: 'C-2',
          competenciaInicio: '06/2026',
          qtdeParcelas: 84,
          valorParcela: 150.5,
        }), // 2 × 150,50 = 301
        contrato({ contrato: 'C-3', competenciaInicio: '01/2026', qtdeParcelas: 84 }), // sem valor ⇒ 0
      ],
      HOJE,
    );
    expect(resultado.total).toBeCloseTo(1301, 2);
    expect(resultado.contratosSemValor).toBe(1);
    expect(resultado.porContrato).toHaveLength(3);
    expect(resultado.porContrato[0]).toMatchObject({
      contrato: 'C-1',
      parcelasDescontadas: 5,
      valorDescontado: 1000,
    });
  });

  it('GARANTIA 100% REAL: valor-parcela MAIOR que o emprestado é lido errado ⇒ NÃO conta', () => {
    // Caso real: o valor do empréstimo (R$25.635) caiu na casa da parcela.
    const resultado = potencialDeRecuperacao(
      [
        contrato({
          competenciaInicio: '03/2026',
          qtdeParcelas: 84,
          valorParcela: 25635.01,
          valorEmprestado: 26.58,
        }),
      ],
      HOJE,
    );
    expect(resultado.total).toBe(0);
    expect(resultado.contratosSemValor).toBe(1);
    expect(resultado.porContrato[0]?.valorDescontado).toBeNull();
  });
});
