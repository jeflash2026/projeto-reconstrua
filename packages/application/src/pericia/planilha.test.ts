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
    const csv = exporter.gerar({ nome: 'x', colunas: ['A'], linhas: [['a;b'], ['diz "oi"'], [null]] });
    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"diz ""oi"""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('números saem no formato pt-BR (vírgula)', () => {
    const csv = exporter.gerar({ nome: 'x', colunas: ['V'], linhas: [[1234.5]] });
    expect(csv).toContain('1234,50');
  });
});
