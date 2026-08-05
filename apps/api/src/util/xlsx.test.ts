// Testes do XLSX mínimo (2026-08-05) — o Excel real do pacote do perito:
// zip válido, contrato como TEXTO (nunca notação científica), larguras
// calculadas e linha em branco (separador de banco) preservada.
import { describe, it, expect } from 'vitest';
import { xlsxDePlanilha } from './xlsx.js';

describe('xlsxDePlanilha', () => {
  const colunas = ['Banco', 'Contrato', 'Valor parcela (R$)'];
  const linhas: ReadonlyArray<ReadonlyArray<string | number | null>> = [
    ['AGIBANK', '1500861079', 337.75],
    [null, null, null], // separador de banco (linha em branco)
    ['BANCO PAN', '0229015274193', 359.78],
  ];

  it('gera um zip válido (assinatura PK) com as partes obrigatórias', () => {
    const buf = xlsxDePlanilha('Contratos', colunas, linhas);
    expect(buf.subarray(0, 2).toString('ascii')).toBe('PK');
    const texto = buf.toString('utf8');
    for (const parte of [
      '[Content_Types].xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
      'xl/styles.xml',
    ]) {
      expect(texto).toContain(parte);
    }
  });

  it('contrato sai como TEXTO inteiro (inlineStr) e número como número', () => {
    const texto = xlsxDePlanilha('Contratos', colunas, linhas).toString('utf8');
    // O caso real do dono: "1,5E+09" na tela — aqui o contrato é string.
    expect(texto).toContain('<t xml:space="preserve">1500861079</t>');
    expect(texto).toContain('<t xml:space="preserve">0229015274193</t>');
    expect(texto).toContain('<v>337.75</v>');
    // Larguras customizadas presentes e cabeçalho congelado.
    expect(texto).toContain('customWidth="1"');
    expect(texto).toContain('state="frozen"');
  });

  it('linha em branco (separador) vira row vazia — o respiro é preservado', () => {
    const texto = xlsxDePlanilha('Contratos', colunas, linhas).toString('utf8');
    expect(texto).toContain('<row r="3"></row>');
  });
});
