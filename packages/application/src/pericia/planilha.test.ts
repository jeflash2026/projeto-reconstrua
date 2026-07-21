// ─────────────────────────────────────────────────────────────────────────────
// PLANILHA (B-R2) — testes: CSV Excel-BR (BOM + ';'), escape, números pt-BR e a
// Lei 9 aplicada à exportação (dentro/fora da janela e não reconhecidas — tudo sai).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { parseHiscon } from './hiscon.js';
import { CsvPlanilhaExporter, planilhaDeContratos, COLUNAS_CONTRATOS } from './planilha.js';

const HOJE = new Date('2026-07-18T12:00:00.000Z');

const EXTRATO = [
  'BANCO BMG S/A',
  'Contrato 000111222333 Inclusão 05/03/2024 Parcela R$ 45,30 ATIVO',
  'Contrato 000111222444 Inclusão 10/01/2020 Parcela R$ 89,90 QUITADO',
  'Linha com data 01/02/2024 e valor R$ 10,00 sem contrato',
].join('\n');

describe('planilhaDeContratos · Lei 9 na exportação', () => {
  it('inclui TUDO: dentro da janela, fora da janela e não reconhecidas', () => {
    const plan = planilhaDeContratos('Contratos — Maria', parseHiscon(EXTRATO, HOJE));
    expect(plan.colunas).toEqual(COLUNAS_CONTRATOS);
    expect(plan.linhas).toHaveLength(3);
    const classificacoes = plan.linhas.map((l) => l[5]);
    expect(classificacoes).toEqual(['DENTRO_5_ANOS', 'FORA_5_ANOS', 'NAO_RECONHECIDA']);
    // linha não reconhecida preserva a linha original para o perito
    expect(plan.linhas[2]?.[6]).toContain('sem contrato');
  });

  it('formata data dd/mm/aaaa e valores pt-BR', () => {
    const plan = planilhaDeContratos('x', parseHiscon(EXTRATO, HOJE));
    expect(plan.linhas[0]?.[2]).toBe('05/03/2024');
    expect(plan.linhas[0]?.[4]).toBe('45,30');
  });
});

describe('CsvPlanilhaExporter · Excel pt-BR', () => {
  const exporter = new CsvPlanilhaExporter();

  it('gera com BOM UTF-8, separador ";" e CRLF', () => {
    const csv = exporter.gerar({ nome: 'x', colunas: ['A', 'B'], linhas: [['1', '2']] });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('A;B\r\n');
    expect(csv).toContain('1;2\r\n');
    expect(exporter.extensao).toBe('csv');
    expect(exporter.mime).toContain('text/csv');
  });

  it('escapa campos com ";" e aspas', () => {
    const csv = exporter.gerar({
      nome: 'x',
      colunas: ['A'],
      linhas: [['a;b'], ['diz "oi"'], [null]],
    });
    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"diz ""oi"""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('números saem no formato pt-BR (vírgula)', () => {
    const csv = exporter.gerar({ nome: 'x', colunas: ['V'], linhas: [[1234.5]] });
    expect(csv).toContain('1234,50');
  });
});

// ── Decreto Dossiê Pericial: a planilha DETALHADA (formato real em blocos) ───
import { planilhaDeContratosDetalhada, COLUNAS_CONTRATOS_DETALHADA } from './planilha.js';
import { parseHisconDetalhado } from './hiscon-parser.js';

describe('planilhaDeContratosDetalhada · o CSV que vinha VAZIO em produção', () => {
  const HISCON = [
    'EMPRÉSTIMOS BANCÁRIOS',
    '',
    'CONTRATO: 0328380631IMC',
    'BANCO: 753 - NOVO BANCO CONTINENTAL S A',
    'SITUAÇÃO: Ativo',
    'ORIGEM DA AVERBAÇÃO: Migrado do contrato 0328380631IMC CBC: 329',
    'DATA INCLUSÃO: 27/02/26',
    'QTDE PARCELAS: 96',
    'VALOR PARCELA: R$36,05',
    '',
    'CONTRATO: 0123528811531',
    'BANCO: 237 - BANCO BRADESCO S A',
    'SITUAÇÃO: Ativo',
    'ORIGEM DA AVERBAÇÃO: Averbação nova',
    'DATA INCLUSÃO: 15/04/25',
    'VALOR PARCELA: R$89,57',
  ].join('\n');

  it('organizada POR BANCO, com migração e janela marcadas', () => {
    const extraido = parseHisconDetalhado(HISCON);
    const plan = planilhaDeContratosDetalhada(
      'Contratos — Isabel',
      extraido,
      new Date('2026-07-21T00:00:00Z'),
    );
    expect(plan.colunas).toEqual(COLUNAS_CONTRATOS_DETALHADA);
    expect(plan.linhas).toHaveLength(2);
    // Ordem alfabética por banco: Bradesco antes do Novo Banco Continental.
    expect(plan.linhas[0]?.[0]).toBe('BANCO BRADESCO S A');
    expect(plan.linhas[1]?.[0]).toBe('NOVO BANCO CONTINENTAL S A');
    const migrado = plan.linhas[1];
    expect(migrado?.[6]).toBe('SIM'); // Migrado
    expect(migrado?.[7]).toBe('0328380631IMC'); // Migrado do contrato
    expect(migrado?.[8]).toBe('329'); // Banco de origem (CBC)
    expect(migrado?.[22]).toBe('DENTRO_5_ANOS');
  });

  it('CSV gerado tem cabeçalho completo e valores em pt-BR', () => {
    const extraido = parseHisconDetalhado(HISCON);
    const plan = planilhaDeContratosDetalhada('X', extraido, new Date('2026-07-21T00:00:00Z'));
    const csv = new CsvPlanilhaExporter().gerar(plan);
    expect(csv).toContain('Origem da averba');
    expect(csv).toContain('36,05');
    expect(csv).toContain('Migrado do contrato 0328380631IMC CBC: 329');
  });
});
