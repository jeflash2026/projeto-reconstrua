// COBRANÇA DOCUMENTAL — a regra que a Sandra provou estar quebrada. O teste
// central é o caso dela: com três dos quatro documentos entregues, a cobrança
// tem de pedir UM, e nunca os quatro.
import { describe, expect, it } from 'vitest';
import { cobrancaDocumental } from './cobranca-documental.js';

const NADA = { procuracao: false, rg: false, comprovante: false, extratoCredito: false };

describe('cobrancaDocumental', () => {
  it('caso Sandra: só a procuração falta — cobra só ela', () => {
    const c = cobrancaDocumental({
      procuracao: false,
      rg: true,
      comprovante: true,
      extratoCredito: true,
    });
    expect(c.faltantes).toEqual(['a procuração assinada']);
    expect(c.lista).toBe('a procuração assinada');
    expect(c.template).toBe('documentos_pendentes');
    expect(c.completo).toBe(false);
    // O que ela recebeu antes da correção — nunca mais.
    expect(c.lista).not.toContain('RG');
    expect(c.lista).not.toContain('comprovante');
    expect(c.lista).not.toContain('extrato');
  });

  it('escreve a lista como frase quando falta mais de um', () => {
    expect(
      cobrancaDocumental({ procuracao: false, rg: false, comprovante: true, extratoCredito: true })
        .lista,
    ).toBe('a procuração assinada e o RG (frente e verso)');
    expect(
      cobrancaDocumental({ procuracao: false, rg: false, comprovante: false, extratoCredito: true })
        .lista,
    ).toBe('a procuração assinada, o RG (frente e verso) e o comprovante de endereço');
  });

  it('quem não entregou nada recebe a apresentação, não a cobrança', () => {
    const c = cobrancaDocumental(NADA);
    expect(c.entregouAlgum).toBe(false);
    expect(c.template).toBe('contato_equipe');
    expect(c.faltantes).toHaveLength(4);
  });

  it('cadastro antigo sem o campo do extrato ainda cobra o extrato', () => {
    const c = cobrancaDocumental({ procuracao: true, rg: true, comprovante: true });
    expect(c.faltantes).toEqual(['o extrato do INSS dos últimos 3 meses']);
    expect(c.completo).toBe(false);
  });

  it('não há o que cobrar de quem entregou tudo', () => {
    const c = cobrancaDocumental({
      procuracao: true,
      rg: true,
      comprovante: true,
      extratoCredito: true,
    });
    expect(c.completo).toBe(true);
    expect(c.faltantes).toEqual([]);
    expect(c.lista).toBe('');
  });
});
