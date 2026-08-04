// ─────────────────────────────────────────────────────────────────────────────
// Testes do GUIA DE AGRUPAMENTO EM AÇÕES (decreto 2026-08-04) — as regras que
// o dossiê do advogado explica, provadas uma a uma:
//   • ativos: 1=1; exceção mesmo banco + mesmo dia (±1) agrupa;
//   • excluídos: mesmo ano + mesmo banco agrupa; bancos nunca se misturam;
//   • RMC/RCC: sempre separados;
//   • sem data/ano legível: não agrupa (declarado na regra — Lei 9).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { agruparContratosEmAcoes, categoriaDoContrato } from './acoes.js';
import type { ContratoHiscon } from './hiscon-parser.js';

const HOJE = new Date('2026-08-04T12:00:00Z');

function contrato(parcial: Partial<ContratoHiscon>): ContratoHiscon {
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
    dataInclusao: new Date('2025-03-10T00:00:00Z'),
    competenciaInicio: '04/2025',
    competenciaFim: null, // ativo/aberto ⇒ dentro da janela
    qtdeParcelas: 84,
    valorParcela: 100,
    valorEmprestado: 5000,
    valorLiberado: null,
    iof: null,
    cetMensal: null,
    cetAnual: null,
    taxaJurosMensal: null,
    taxaJurosAnual: null,
    valorPago: null,
    dataPrimeiroDesconto: null,
    ...parcial,
  };
}

describe('categoriaDoContrato', () => {
  it('modalidade manda: RMC e RCC têm categoria própria mesmo ativos', () => {
    expect(categoriaDoContrato(contrato({ modalidade: 'RMC' }))).toBe('RMC');
    expect(categoriaDoContrato(contrato({ modalidade: 'RCC' }))).toBe('RCC');
  });

  it('empréstimo ATIVO vs. excluído/encerrado — e INATIVO não conta como ativo', () => {
    expect(categoriaDoContrato(contrato({ situacao: 'Ativo' }))).toBe('ATIVOS');
    expect(categoriaDoContrato(contrato({ situacao: 'EXCLUÍDO' }))).toBe('EXCLUIDOS');
    expect(categoriaDoContrato(contrato({ situacao: 'Encerrado' }))).toBe('EXCLUIDOS');
    expect(categoriaDoContrato(contrato({ situacao: 'Inativo' }))).toBe('EXCLUIDOS');
    expect(categoriaDoContrato(contrato({ situacao: null }))).toBe('EXCLUIDOS');
  });
});

describe('agruparContratosEmAcoes — ATIVOS', () => {
  it('regra geral: 1 contrato = 1 ação (bancos e dias diferentes)', () => {
    const r = agruparContratosEmAcoes(
      [
        contrato({ contrato: 'A', dataInclusao: new Date('2025-01-10T00:00:00Z') }),
        contrato({ contrato: 'B', dataInclusao: new Date('2025-05-20T00:00:00Z') }),
        contrato({
          contrato: 'C',
          bancoCodigo: '033',
          bancoNome: 'SANTANDER',
          dataInclusao: new Date('2025-01-10T00:00:00Z'),
        }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(3);
    expect(r.acoes.every((a) => a.contratos.length === 1)).toBe(true);
  });

  it('EXCEÇÃO: mesmo banco + mesmo dia (ou 1 dia de diferença) agrupa em UMA ação', () => {
    const r = agruparContratosEmAcoes(
      [
        contrato({ contrato: 'A', dataInclusao: new Date('2025-01-10T00:00:00Z') }),
        contrato({ contrato: 'B', dataInclusao: new Date('2025-01-10T00:00:00Z') }),
        contrato({ contrato: 'C', dataInclusao: new Date('2025-01-11T00:00:00Z') }),
        // 5 dias depois — NÃO entra no grupo
        contrato({ contrato: 'D', dataInclusao: new Date('2025-01-16T00:00:00Z') }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(2);
    const grande = r.acoes.find((a) => a.contratos.length === 3);
    expect(grande?.contratos.map((c) => c.contrato)).toEqual(['A', 'B', 'C']);
    expect(grande?.regra).toContain('mesmo dia');
  });

  it('mesmo dia mas bancos DIFERENTES: nunca agrupa', () => {
    const r = agruparContratosEmAcoes(
      [
        contrato({ contrato: 'A', dataInclusao: new Date('2025-01-10T00:00:00Z') }),
        contrato({
          contrato: 'B',
          bancoCodigo: '033',
          bancoNome: 'SANTANDER',
          dataInclusao: new Date('2025-01-10T00:00:00Z'),
        }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(2);
  });

  it('ativo sem data legível: ação própria com a ressalva declarada', () => {
    const r = agruparContratosEmAcoes(
      [contrato({ contrato: 'A', dataInclusao: null, dataPrimeiroDesconto: null })],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(1);
    expect(r.acoes[0]?.regra).toContain('Sem data legível');
  });
});

describe('agruparContratosEmAcoes — EXCLUÍDOS (prescrição 5 anos)', () => {
  const excluido = (p: Partial<ContratoHiscon>): ContratoHiscon =>
    contrato({
      situacao: 'EXCLUÍDO',
      // encerrado RECENTE (dentro da janela de 5 anos do pipeline)
      competenciaFim: '01/2025',
      ...p,
    });

  it('mesmo ano + mesmo banco = UMA ação; bancos diferentes sempre separados', () => {
    const r = agruparContratosEmAcoes(
      [
        excluido({ contrato: 'A', dataInclusao: new Date('2023-02-01T00:00:00Z') }),
        excluido({ contrato: 'B', dataInclusao: new Date('2023-09-15T00:00:00Z') }),
        excluido({ contrato: 'C', dataInclusao: new Date('2023-11-30T00:00:00Z') }),
        // mesmo ano, banco DIFERENTE ⇒ separado
        excluido({
          contrato: 'D',
          bancoCodigo: '033',
          bancoNome: 'SANTANDER',
          dataInclusao: new Date('2023-06-01T00:00:00Z'),
        }),
        // mesmo banco, ANO diferente ⇒ separado
        excluido({ contrato: 'E', dataInclusao: new Date('2024-01-05T00:00:00Z') }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(3);
    const grupo = r.acoes.find((a) => a.contratos.length === 3);
    expect(grupo?.contratos.map((c) => c.contrato)).toEqual(['A', 'B', 'C']);
    expect(grupo?.regra).toContain('2023');
    expect(r.resumo.porCategoria.EXCLUIDOS).toBe(3);
  });

  it('sem dataInclusao, o ANO vem da competência de início', () => {
    const r = agruparContratosEmAcoes(
      [
        excluido({ contrato: 'A', dataInclusao: null, competenciaInicio: '03/2022' }),
        excluido({ contrato: 'B', dataInclusao: null, competenciaInicio: '10/2022' }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(1);
    expect(r.acoes[0]?.contratos).toHaveLength(2);
  });
});

describe('agruparContratosEmAcoes — RMC/RCC e resumo', () => {
  it('RMC e RCC SEMPRE separados, mesmo banco e mesmo dia', () => {
    const dia = new Date('2025-01-10T00:00:00Z');
    const r = agruparContratosEmAcoes(
      [
        contrato({ contrato: 'A', modalidade: 'RMC', dataInclusao: dia }),
        contrato({ contrato: 'B', modalidade: 'RMC', dataInclusao: dia }),
        contrato({ contrato: 'C', modalidade: 'RCC', dataInclusao: dia }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(3);
    expect(r.resumo.porCategoria).toMatchObject({ RMC: 2, RCC: 1 });
  });

  it('resumo soma tudo; numeração sequencial 1..N', () => {
    const r = agruparContratosEmAcoes(
      [
        contrato({ contrato: 'A', dataInclusao: new Date('2025-01-10T00:00:00Z') }),
        contrato({ contrato: 'B', modalidade: 'RMC' }),
        contrato({
          contrato: 'C',
          situacao: 'EXCLUÍDO',
          competenciaFim: '01/2025',
          dataInclusao: new Date('2023-01-01T00:00:00Z'),
        }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(3);
    expect(r.resumo.totalContratos).toBe(3);
    expect(r.acoes.map((a) => a.numero)).toEqual([1, 2, 3]);
  });

  it('contrato encerrado FORA da janela de 5 anos não entra em ação nenhuma', () => {
    const r = agruparContratosEmAcoes(
      [
        contrato({
          contrato: 'VELHO',
          situacao: 'EXCLUÍDO',
          competenciaFim: '01/2019', // encerrado há mais de 5 anos
          dataInclusao: new Date('2015-01-01T00:00:00Z'),
        }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(0);
    expect(r.resumo.totalContratos).toBe(0);
  });
});
