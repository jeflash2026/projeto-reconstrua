// ─────────────────────────────────────────────────────────────────────────────
// HISCON PARSER (B-R1) — testes do parser determinístico. Cobre os dois layouts
// (cabeçalho de banco + linhas; banco inline), a janela de 5 anos, valores BRL,
// situação, contrato sem data, linhas declaradas (Regra 6) e determinismo.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { parseHiscon } from './hiscon.js';

const HOJE = new Date('2026-07-18T12:00:00.000Z');

const EXTRATO = [
  'HISTÓRICO DE EMPRÉSTIMOS CONSIGNADOS — BENEFÍCIO 123.456.789-0',
  '',
  'BANCO BMG S/A',
  'Contrato 000111222333 Inclusão 05/03/2024 Parcela R$ 45,30 Emprestado R$ 1.500,00 ATIVO',
  'Contrato 000111222444 Inclusão 10/01/2020 Parcela R$ 89,90 Emprestado R$ 3.200,00 QUITADO',
  '',
  'BANCO PAN S.A.',
  'Contrato 555666777 Inclusão 20/05/2023 Parcela R$ 120,00 Emprestado R$ 4.000,00 ATIVO',
  '',
  'BANCO ITAU CONSIGNADO S/A 999888777666 12/12/2025 R$ 77,70 R$ 2.100,00 SUSPENSO',
  '',
  'Linha estranha com data 01/02/2024 e valor R$ 10,00 mas sem numero de contrato',
  'Página 1 de 2 — emitido em 18/07/2026',
].join('\n');

describe('parseHiscon · layouts e agrupamento', () => {
  it('reconhece contratos sob cabeçalho de banco e agrupa por banco', () => {
    const r = parseHiscon(EXTRATO, HOJE);
    const bmg = r.porBanco['BANCO BMG S/A'];
    expect(bmg).toHaveLength(1); // o de 2020 caiu fora da janela
    expect(bmg?.[0]?.contrato).toBe('000111222333');
    expect(bmg?.[0]?.situacao).toBe('ATIVO');
    expect(bmg?.[0]?.dataInicio?.toISOString().slice(0, 10)).toBe('2024-03-05');
    expect(bmg?.[0]?.valores).toEqual([45.3, 1500]);

    expect(r.porBanco['BANCO PAN S.A.']?.[0]?.contrato).toBe('555666777');
  });

  it('reconhece banco INLINE na própria linha do contrato', () => {
    const r = parseHiscon(EXTRATO, HOJE);
    const itau = r.contratos.find((c) => c.contrato === '999888777666');
    expect(itau?.banco).toBe('BANCO ITAU CONSIGNADO S/A');
    expect(itau?.situacao).toBe('SUSPENSO');
  });

  it('aplica a janela de 5 anos: contrato de 2020 vai para foraDaJanela', () => {
    const r = parseHiscon(EXTRATO, HOJE);
    expect(r.janelaInicio.toISOString().slice(0, 10)).toBe('2021-07-18');
    expect(r.foraDaJanela).toHaveLength(1);
    expect(r.foraDaJanela[0]?.contrato).toBe('000111222444');
    expect(r.contratos.some((c) => c.contrato === '000111222444')).toBe(false);
  });

  it('Regra 6: candidata sem contrato identificável é DECLARADA, nunca inventada', () => {
    const r = parseHiscon(EXTRATO, HOJE);
    expect(r.naoReconhecidas).toHaveLength(1);
    expect(r.naoReconhecidas[0]).toContain('Linha estranha');
    // e linhas não-candidatas (título, rodapé sem valor) são simplesmente ignoradas
    expect(r.contratos.every((c) => !c.linhaOrigem.includes('Página 1'))).toBe(true);
  });
});

describe('parseHiscon · regras de borda', () => {
  it('contrato sem data fica DENTRO (o perito decide) — nunca descartado', () => {
    const texto = 'BANCO X S/A\nContrato 123456789 Parcela R$ 50,00 ATIVO';
    const r = parseHiscon(texto, HOJE);
    expect(r.contratos).toHaveLength(1);
    expect(r.contratos[0]?.dataInicio).toBeNull();
    expect(r.foraDaJanela).toHaveLength(0);
  });

  it('data impossível (31/02) não vira data — contrato entra sem data', () => {
    const texto = 'BANCO X S/A\nContrato 123456789 Inclusão 31/02/2024 Parcela R$ 50,00';
    const r = parseHiscon(texto, HOJE);
    expect(r.contratos[0]?.dataInicio).toBeNull();
  });

  it('sem cabeçalho e sem banco inline → BANCO NÃO IDENTIFICADO (declarado, não inventado)', () => {
    const texto = 'Contrato 123456789 Inclusão 05/03/2024 Parcela R$ 50,00';
    const r = parseHiscon(texto, HOJE);
    expect(r.contratos[0]?.banco).toBe('BANCO NÃO IDENTIFICADO');
  });

  it('valores BRL com milhar parseiam corretamente', () => {
    const texto = 'BANCO X S/A\nContrato 123456789 01/01/2024 R$ 1.234,56 R$ 12.345.678,90';
    const r = parseHiscon(texto, HOJE);
    expect(r.contratos[0]?.valores).toEqual([1234.56, 12345678.9]);
  });

  it('é determinístico: mesma entrada + mesma referência ⇒ resultado idêntico', () => {
    expect(parseHiscon(EXTRATO, HOJE)).toEqual(parseHiscon(EXTRATO, HOJE));
  });

  it('texto vazio ⇒ resultado vazio consistente', () => {
    const r = parseHiscon('', HOJE);
    expect(r.contratos).toEqual([]);
    expect(r.foraDaJanela).toEqual([]);
    expect(r.naoReconhecidas).toEqual([]);
    expect(r.porBanco).toEqual({});
  });
});
