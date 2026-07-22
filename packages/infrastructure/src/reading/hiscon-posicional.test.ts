// ─────────────────────────────────────────────────────────────────────────────
// Reconstrução POSICIONAL do HISCON (Frente 2) — prova que, dada a MATRIZ (colunas
// = contratos, linhas = atributos, rótulos rotacionados à esquerda), cada valor
// cai no CAMPO e no CONTRATO certos — o que a Vision embaralhava. Itens sintéticos
// (sem PDF), depois parseados pelo parseHisconDetalhado REAL para o fim-a-fim.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { parseHisconDetalhado, potencialDeRecuperacao } from '@reconstrua/application';
import { reconstruirHisconPosicional, type ItemPosicional } from './hiscon-posicional.js';

/** Item pdf.js sintético: só o que o reconstrutor usa (str + x,y na transform). */
function item(str: string, x: number, y: number): ItemPosicional {
  return { str, transform: [1, 0, 0, 1, x, y] };
}

// Duas colunas de contrato (x=150 e x=200); rótulos rotacionados à esquerda (x=120).
// Cada linha de atributo tem um Y; o rótulo fica na mesma faixa de Y dos valores.
function matrizDeDuasColunas(): ItemPosicional[] {
  const L = (t: string, y: number) => item(t, 120, y);
  const A = (t: string, y: number) => item(t, 150, y); // contrato A
  const B = (t: string, y: number) => item(t, 200, y); // contrato B
  return [
    // números de contrato (linha mais baixa em Y)
    A('123456789', 20),
    B('987654321', 20),
    L('BANCO', 40),
    // Nome do banco vem em VÁRIOS fragmentos (juntados com espaço na mesma coluna).
    item('001', 144, 40),
    item('-', 148, 40),
    item('BANCO', 152, 40),
    item('DO', 158, 40),
    item('BRASIL', 163, 40),
    item('237', 195, 40),
    item('-', 199, 40),
    item('BRADESCO', 203, 40),
    L('SITUAÇÃO', 55),
    A('Ativo', 55),
    B('Ativo', 55),
    L('COMPETÊNCIA INÍCIO DE DESCONTO', 70),
    A('03/2026', 70),
    B('01/2020', 70),
    L('FIM DE DESCONTO', 85),
    A('02/2032', 85),
    B('12/2025', 85),
    L('QTDE PARCELAS', 100),
    A('84', 100),
    B('60', 100),
    L('VALOR PARCELA', 115),
    A('R$200,00', 115),
    B('R$150,00', 115),
    L('EMPRESTADO', 130),
    A('R$10.000,00', 130),
    B('R$5.000,00', 130),
  ];
}

describe('reconstruirHisconPosicional', () => {
  it('mapeia cada valor ao CAMPO e ao CONTRATO certos (o que a Vision embaralhava)', () => {
    const texto = reconstruirHisconPosicional([matrizDeDuasColunas()]);
    expect(texto).not.toBeNull();
    const e = parseHisconDetalhado(texto as string);
    expect(e.contratos).toHaveLength(2);

    const a = e.contratos.find((c) => c.contrato === '123456789');
    expect(a?.bancoNome).toBe('BANCO DO BRASIL');
    expect(a?.competenciaInicio).toBe('03/2026');
    expect(a?.competenciaFim).toBe('02/2032');
    expect(a?.qtdeParcelas).toBe(84);
    expect(a?.valorParcela).toBeCloseTo(200);
    expect(a?.valorEmprestado).toBeCloseTo(10000);

    const b = e.contratos.find((c) => c.contrato === '987654321');
    expect(b?.competenciaInicio).toBe('01/2020');
    expect(b?.valorParcela).toBeCloseTo(150);
    expect(b?.valorEmprestado).toBeCloseTo(5000);
  });

  it('os dados reconstruídos passam pela trava de coerência (parcela < emprestado)', () => {
    const texto = reconstruirHisconPosicional([matrizDeDuasColunas()]);
    const e = parseHisconDetalhado(texto as string);
    const pot = potencialDeRecuperacao(e.contratos, new Date('2026-07-22T00:00:00Z'));
    // Nenhum contrato é rejeitado: parcela ≤ emprestado e há qtde/fim.
    expect(pot.contratosSemValor).toBe(0);
    expect(pot.total).toBeGreaterThan(0);
  });

  it('PDF sem tabela de contratos ⇒ null (o chamador cai na extração comum)', () => {
    const semTabela = [item('CONTA DE LUZ', 150, 100), item('R$ 120,00', 150, 80)];
    expect(reconstruirHisconPosicional([semTabela])).toBeNull();
  });
});
