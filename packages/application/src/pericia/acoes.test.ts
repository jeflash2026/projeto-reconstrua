// ─────────────────────────────────────────────────────────────────────────────
// Testes do GUIA DE PROCESSOS v2 (decreto 2026-08-04, modelo comercial) —
// as regras que o negócio cobra, provadas uma a uma:
//   • ativos: 1 contrato = 1 processo, sempre;
//   • não-ativos: 3 do mesmo banco + mesmo ano = 1 processo; sobra fica fora;
//   • teto de 15 processos por banco na divisão; maiores valores primeiro;
//   • RMC/RCC: 1 = 1 processo;
//   • resumo mostra CONTRATOS totais E PROCESSOS (Maria: 20 contratos ⇒ 6);
//   • a seleção (contratosSelecionadosDoGuia) é a régua do perito/potencial.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  agruparContratosEmAcoes,
  categoriaDoContrato,
  contratosSelecionadosDoGuia,
} from './acoes.js';
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

const naoAtivo = (p: Partial<ContratoHiscon>): ContratoHiscon =>
  contrato({ situacao: 'EXCLUÍDO', competenciaFim: '01/2025', ...p });

describe('categoriaDoContrato', () => {
  it('modalidade manda: RMC e RCC têm categoria própria mesmo ativos', () => {
    expect(categoriaDoContrato(contrato({ modalidade: 'RMC' }))).toBe('RMC');
    expect(categoriaDoContrato(contrato({ modalidade: 'RCC' }))).toBe('RCC');
  });

  it('ATIVO vs. não-ativo — e INATIVO não conta como ativo', () => {
    expect(categoriaDoContrato(contrato({ situacao: 'Ativo' }))).toBe('ATIVOS');
    expect(categoriaDoContrato(contrato({ situacao: 'EXCLUÍDO' }))).toBe('EXCLUIDOS');
    expect(categoriaDoContrato(contrato({ situacao: 'Suspenso' }))).toBe('EXCLUIDOS');
    expect(categoriaDoContrato(contrato({ situacao: 'Inativo' }))).toBe('EXCLUIDOS');
    expect(categoriaDoContrato(contrato({ situacao: null }))).toBe('EXCLUIDOS');
  });
});

describe('ATIVOS — 1 contrato = 1 processo, sempre', () => {
  it('3 ativos do MESMO banco no MESMO dia = 3 processos (sem agrupamento)', () => {
    const dia = new Date('2025-01-10T00:00:00Z');
    const r = agruparContratosEmAcoes(
      [
        contrato({ contrato: 'A', dataInclusao: dia }),
        contrato({ contrato: 'B', dataInclusao: dia }),
        contrato({ contrato: 'C', dataInclusao: dia }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(3);
    expect(r.resumo.porCategoria.ATIVOS).toBe(3);
    expect(r.acoes.every((a) => a.contratos.length === 1)).toBe(true);
  });
});

describe('NÃO-ATIVOS — 3 do mesmo banco + mesmo ano = 1 processo', () => {
  it('caso MARIA: 20 contratos do mesmo banco/ano ⇒ 6 processos (sobra 2 fora); resumo mostra os DOIS números', () => {
    const vinte = Array.from({ length: 20 }, (_, i) =>
      naoAtivo({
        contrato: `M-${String(i)}`,
        dataInclusao: new Date('2023-05-01T00:00:00Z'),
        valorEmprestado: 1000 + i,
      }),
    );
    const r = agruparContratosEmAcoes(vinte, HOJE);
    expect(r.resumo.totalAcoes).toBe(6); // 20 ÷ 3 = 6 processos
    expect(r.resumo.totalContratos).toBe(20); // a soma REAL do cliente
    expect(r.resumo.contratosSelecionados).toBe(18);
    expect(r.resumo.contratosForaDaSelecao).toBe(2);
    expect(r.acoes.every((a) => a.contratos.length === 3)).toBe(true);
  });

  it('bancos diferentes nunca se misturam; anos diferentes nunca se misturam', () => {
    const r = agruparContratosEmAcoes(
      [
        // 2 do Itaú 2023 + 1 do Itaú 2024 ⇒ nenhum trio fecha
        naoAtivo({ contrato: 'A', dataInclusao: new Date('2023-01-01T00:00:00Z') }),
        naoAtivo({ contrato: 'B', dataInclusao: new Date('2023-06-01T00:00:00Z') }),
        naoAtivo({ contrato: 'C', dataInclusao: new Date('2024-01-01T00:00:00Z') }),
        // 3 do Santander 2023 ⇒ 1 processo
        naoAtivo({
          contrato: 'D',
          bancoCodigo: '033',
          bancoNome: 'SANTANDER',
          dataInclusao: new Date('2023-02-01T00:00:00Z'),
        }),
        naoAtivo({
          contrato: 'E',
          bancoCodigo: '033',
          bancoNome: 'SANTANDER',
          dataInclusao: new Date('2023-03-01T00:00:00Z'),
        }),
        naoAtivo({
          contrato: 'F',
          bancoCodigo: '033',
          bancoNome: 'SANTANDER',
          dataInclusao: new Date('2023-04-01T00:00:00Z'),
        }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(1);
    expect(r.acoes[0]?.banco).toContain('SANTANDER');
    expect(r.resumo.contratosForaDaSelecao).toBe(3); // os 3 do Itaú sem trio
  });

  it('os trios saem dos MAIORES valores para os menores', () => {
    // 5 contratos do mesmo banco/ano: só os 3 MAIORES entram no único trio.
    const r = agruparContratosEmAcoes(
      [
        naoAtivo({ contrato: 'V-100', valorEmprestado: 100 }),
        naoAtivo({ contrato: 'V-900', valorEmprestado: 900 }),
        naoAtivo({ contrato: 'V-500', valorEmprestado: 500 }),
        naoAtivo({ contrato: 'V-700', valorEmprestado: 700 }),
        naoAtivo({ contrato: 'V-300', valorEmprestado: 300 }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(1);
    expect(r.acoes[0]?.contratos.map((c) => c.contrato)).toEqual(['V-900', 'V-700', 'V-500']);
  });

  it('TETO: no máximo 15 processos por banco na divisão (60 contratos ⇒ 15, não 20)', () => {
    const sessenta = Array.from({ length: 60 }, (_, i) =>
      naoAtivo({
        contrato: `T-${String(i)}`,
        dataInclusao: new Date('2022-03-01T00:00:00Z'),
        valorEmprestado: 100 + i,
      }),
    );
    const r = agruparContratosEmAcoes(sessenta, HOJE);
    expect(r.resumo.totalAcoes).toBe(15); // 60÷3=20, teto corta em 15
    expect(r.resumo.contratosSelecionados).toBe(45);
    // outro banco tem teto PRÓPRIO (o teto é por banco, não global)
    const comOutroBanco = agruparContratosEmAcoes(
      [
        ...sessenta,
        ...Array.from({ length: 6 }, (_, i) =>
          naoAtivo({
            contrato: `P-${String(i)}`,
            bancoCodigo: '623',
            bancoNome: 'PAN',
            dataInclusao: new Date('2022-03-01T00:00:00Z'),
          }),
        ),
      ],
      HOJE,
    );
    expect(comOutroBanco.resumo.totalAcoes).toBe(17); // 15 (Itaú) + 2 (PAN)
  });

  it('sem ano legível não entra em trio (fora da seleção, nunca inventado)', () => {
    const r = agruparContratosEmAcoes(
      [
        naoAtivo({ contrato: 'A', dataInclusao: null, competenciaInicio: null }),
        naoAtivo({ contrato: 'B', dataInclusao: null, competenciaInicio: null }),
        naoAtivo({ contrato: 'C', dataInclusao: null, competenciaInicio: null }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(0);
    expect(r.resumo.contratosForaDaSelecao).toBe(3);
  });
});

describe('RMC/RCC, janela e seleção', () => {
  it('RMC e RCC sempre separados: 1 = 1 processo', () => {
    const r = agruparContratosEmAcoes(
      [
        contrato({ contrato: 'A', modalidade: 'RMC' }),
        contrato({ contrato: 'B', modalidade: 'RMC' }),
        contrato({ contrato: 'C', modalidade: 'RCC' }),
      ],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(3);
    expect(r.resumo.porCategoria).toMatchObject({ RMC: 2, RCC: 1 });
  });

  it('encerrado FORA da janela de 5 anos não conta em nada', () => {
    const r = agruparContratosEmAcoes(
      [naoAtivo({ contrato: 'VELHO', competenciaFim: '01/2019' })],
      HOJE,
    );
    expect(r.resumo.totalAcoes).toBe(0);
    expect(r.resumo.totalContratos).toBe(0);
  });

  it('contratosSelecionadosDoGuia devolve exatamente a união dos processos', () => {
    const sel = contratosSelecionadosDoGuia(
      [
        contrato({ contrato: 'ATIVO-1' }),
        naoAtivo({ contrato: 'X1', dataInclusao: new Date('2023-01-01T00:00:00Z') }),
        naoAtivo({ contrato: 'X2', dataInclusao: new Date('2023-02-01T00:00:00Z') }),
        naoAtivo({ contrato: 'X3', dataInclusao: new Date('2023-03-01T00:00:00Z') }),
        naoAtivo({ contrato: 'SOBRA', dataInclusao: new Date('2023-04-01T00:00:00Z') }),
      ],
      HOJE,
    );
    expect(sel.map((c) => c.contrato).sort()).toEqual(['ATIVO-1', 'X1', 'X2', 'X3']);
  });
});
