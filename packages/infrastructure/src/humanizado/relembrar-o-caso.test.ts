// RELEMBRAR O CASO — o texto que a secretária manda para quem esqueceu do que
// se trata. Ele vai para um cliente real, então as travas são: nenhum número
// inventado, nenhuma promessa de resultado, e o passo seguinte tem de bater com
// o que falta de verdade.
import { describe, expect, it } from 'vitest';
import { relembrarOCaso } from './relembrar-o-caso.js';

const NADA = { procuracao: false, rg: false, comprovante: false, extratoCredito: false };
const TUDO = { procuracao: true, rg: true, comprovante: true, extratoCredito: true };

describe('relembrarOCaso', () => {
  it('recoloca a pessoa na história: o que mandou, o que achamos, o que ela autorizou', () => {
    const texto = relembrarOCaso({
      nome: 'MARIA DAS DORES SILVA',
      contratos: 7,
      indicios: 3,
      confirmadoEm: '2026-08-05T13:00:00.000Z',
      docs: { ...NADA, rg: true },
    });
    expect(texto).toContain('Oi, Maria!');
    expect(texto).toContain('HISCON');
    expect(texto).toContain('7 contrato(s)');
    expect(texto).toContain('3 com indício');
    expect(texto).toContain('05/08');
    expect(texto).toContain('confirmou por aqui que queria seguir');
    // Sem promessa de ganho — o que se promete é o passo, nunca o resultado.
    expect(texto).not.toMatch(/vai receber|garant|com certeza|ind[ée]nizaç/i);
  });

  it('o passo seguinte é exatamente o que falta', () => {
    const texto = relembrarOCaso({
      nome: 'João',
      contratos: 2,
      indicios: 1,
      confirmadoEm: null,
      docs: { procuracao: false, rg: true, comprovante: true, extratoCredito: true },
    });
    expect(texto).toContain('Falta a procuração assinada');
    expect(texto).not.toContain('RG');
  });

  it('documentação completa muda o recado — nada de cobrar quem já entregou', () => {
    const texto = relembrarOCaso({
      nome: 'Ana',
      contratos: 4,
      indicios: 2,
      confirmadoEm: '2026-08-01T10:00:00.000Z',
      docs: TUDO,
    });
    expect(texto).toContain('documentação já está completa');
    expect(texto).toContain('com o advogado responsável');
    expect(texto).not.toContain('Falta');
  });

  it('sem contrato lido, não inventa número', () => {
    const texto = relembrarOCaso({
      nome: 'Carlos',
      contratos: 0,
      indicios: 0,
      confirmadoEm: null,
      docs: NADA,
    });
    expect(texto).toContain('Analisamos o seu extrato');
    expect(texto).not.toContain('0 contrato');
    expect(texto).not.toContain('indício');
  });

  it('sempre lembra que não há custo — é a dúvida que faz a pessoa sumir', () => {
    const texto = relembrarOCaso({
      nome: 'Ana',
      contratos: 1,
      indicios: 1,
      confirmadoEm: null,
      docs: NADA,
    });
    expect(texto).toContain('sem custo nenhum');
    expect(texto).toContain('apenas se houver êxito');
  });
});
