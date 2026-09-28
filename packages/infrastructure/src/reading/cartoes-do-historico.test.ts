// ─────────────────────────────────────────────────────────────────────────────
// CARTÕES A PARTIR DO HISTÓRICO MENSAL — o caso REAL Luiz Carlos da Cunha
// (2026-09-28) e a proteção do caso NYCOLLAS, que não pode se perder:
//   • HISCON sem tabela de CONTRATOS de cartão: os cartões só existem na tabela
//     mensal. Sem agregar, o cliente perde RMC e RCC inteiros (1 processo cada).
//   • Agregar NÃO pode virar inflar: 67 linhas mensais são DOIS cartões, e 80
//     linhas do MESMO cartão continuam sendo UM.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { blocosDeCartao, cartoesDoHistoricoMensal, jaTemCartoes } from './cartoes-do-historico.js';

/** Uma linha do "DESCONTOS DE CARTÃO" como a extração linear a entrega. */
function linha(opts: {
  numero: string;
  banco?: string;
  saldo?: string;
  situacao?: string;
  competencia: string;
  desconto?: string;
  tipo: 'RMC' | 'RCC';
}): string {
  const banco = opts.banco ?? '623 - BANCO PAN S A';
  const saldo = opts.saldo ?? 'R$11.919,69';
  const situacao = opts.situacao ?? 'Encerrado';
  const desconto = opts.desconto ?? 'R$181,62';
  return (
    `${opts.numero} ${banco} ${saldo}${situacao} ${opts.competencia} ` +
    `${saldo}${desconto} Desconto de cart${opts.tipo === 'RCC' ? 'ao' : 'ão'} (${opts.tipo}) ` +
    'R$29,52 3,09 44,01 2,46 33,86 '
  );
}

const RCC = '623399997312039';
const RMC = '623399997414645';

/** A i-ésima linha para trás a partir de 09/2026 — número e competência juntos,
 *  porque no documento real a competência está DENTRO do número do contrato. */
function mesQueVolta(i: number, base = RCC): { numero: string; competencia: string } {
  const t = 2026 * 12 + 9 - 1 - i;
  const ano = Math.floor(t / 12);
  const mes = String((t % 12) + 1).padStart(2, '0');
  return { numero: `${base}${mes} ${String(ano).slice(2)}`, competencia: `${mes}/${String(ano)}` };
}

const CABECALHO =
  'CARTÃO DE CRÉDITO Instituto Nacional do Seguro Social DESCONTOS DE CARTÃO CONTRATO ' +
  'BANCO SALDO DEVEDORSITUAÇÃO COMPETÊNCIA UTILIZADO NO MÊSDESCONTO VALOR TIPO IOF ';

describe('cartoesDoHistoricoMensal — caso REAL Luiz Carlos', () => {
  // O HISCON dele: 33 linhas de um RCC e 34 de um RMC, ambos do BANCO PAN, com
  // a competência colada no fim do número do contrato.
  const historico =
    CABECALHO +
    // No PDF real o número é BASE(15) + mês(2) + " " + ano(2): a competência
    // vive dentro do próprio número, e é por isso que ele muda todo mês. As
    // linhas descem de 09/2026 para trás, mês a mês, como no documento.
    Array.from({ length: 33 }, (_, i) => linha({ ...mesQueVolta(i), tipo: 'RCC' })).join('') +
    Array.from({ length: 34 }, (_, i) => linha({ ...mesQueVolta(i, RMC), tipo: 'RMC' })).join('');

  it('67 linhas mensais viram DOIS cartões — um RCC e um RMC', () => {
    const cartoes = cartoesDoHistoricoMensal(historico);
    expect(cartoes).toHaveLength(2);
    expect(cartoes.map((c) => c.modalidade).sort()).toEqual(['RCC', 'RMC']);
    for (const c of cartoes) {
      expect(c.banco).toBe('623 - BANCO PAN S A');
      expect(c.competenciaFim).toBe('09/2026'); // o retrato é o mês mais recente
    }
  });

  it('o número do cartão é o PREFIXO comum às linhas, não o do mês', () => {
    const rcc = cartoesDoHistoricoMensal(historico).find((c) => c.modalidade === 'RCC');
    // A competência colada no fim varia mês a mês; o que identifica o cartão é
    // o que não varia. Nada de número que só existe em setembro.
    expect(rcc?.numero).toBe('623399997312039');
  });

  it('o bloco gerado é lido pelo Formato A (seção + campos do parser)', () => {
    const texto = blocosDeCartao(cartoesDoHistoricoMensal(historico));
    expect(texto).toContain('CARTÃO RCC');
    expect(texto).toContain('CARTÃO RMC');
    expect(texto).toContain('BANCO: 623 - BANCO PAN S A');
    expect(texto).toContain('COMPETÊNCIA FIM DE DESCONTO: 09/2026');
  });
});

// CASO NYCOLLAS: ~80 linhas mensais do MESMO cartão viraram "87 contratos".
// Contar linha como contrato fabrica dado num documento jurídico — a régua
// aqui (banco + modalidade) torna isso impossível por construção.
describe('a proteção contra inflar continua de pé', () => {
  it('80 linhas do MESMO cartão são UM cartão', () => {
    const historico =
      CABECALHO +
      Array.from({ length: 80 }, (_, i) =>
        linha({
          numero: `90128265685${String(i).padStart(4, '0')}`,
          banco: '626 - BANCO C6 CONSIGNADO S A',
          competencia: `${String((i % 12) + 1).padStart(2, '0')}/${String(2020 + Math.floor(i / 12))}`,
          tipo: 'RMC',
        }),
      ).join('');
    const cartoes = cartoesDoHistoricoMensal(historico);
    expect(cartoes).toHaveLength(1);
    expect(cartoes[0]?.linhas).toBe(80);
  });

  it('bancos diferentes são cartões diferentes (é a unidade do guia)', () => {
    const historico =
      CABECALHO +
      linha({ numero: '62339999731203909 26', competencia: '09/2026', tipo: 'RCC' }) +
      linha({
        numero: '90128265685123',
        banco: '626 - BANCO C6 CONSIGNADO S A',
        competencia: '09/2026',
        tipo: 'RCC',
      });
    expect(cartoesDoHistoricoMensal(historico)).toHaveLength(2);
  });

  it('texto sem histórico de cartão não inventa nada', () => {
    expect(cartoesDoHistoricoMensal('CONTRATO: 123\nBANCO: 033 - SANTANDER\n')).toEqual([]);
    expect(cartoesDoHistoricoMensal('')).toEqual([]);
  });

  it('linha sem banco ou sem número é descartada (nunca um cartão pela metade)', () => {
    const semBanco = `${CABECALHO}62339999731203909 26 R$11,00Encerrado 09/2026 R$1,00R$2,00 Desconto de cartao (RCC) `;
    expect(cartoesDoHistoricoMensal(semBanco)).toEqual([]);
  });
});

describe('jaTemCartoes — a agregação só entra quando faltou cartão', () => {
  it('reconhece a leitura que JÁ trouxe contratos de cartão', () => {
    expect(jaTemCartoes('EMPRÉSTIMOS BANCÁRIOS\nCONTRATO: 1\n\nCARTÃO RMC\nCONTRATO: 2')).toBe(
      true,
    );
    expect(jaTemCartoes('CARTÃO RCC\nCONTRATO: 9')).toBe(true);
  });

  it('leitura só de empréstimos não tem cartão nenhum', () => {
    expect(jaTemCartoes('EMPRÉSTIMOS BANCÁRIOS\nCONTRATO: 387434757-2\nBANCO: 623 - PAN')).toBe(
      false,
    );
  });
});
