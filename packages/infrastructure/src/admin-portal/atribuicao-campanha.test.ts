// ATRIBUIÇÃO DE CAMPANHA — a origem vem carimbada na primeira mensagem que o
// cliente manda pela landing. O que importa não é quem traz mais gente: é quem
// traz gente que FECHA.
import { describe, expect, it } from 'vitest';
import { AtribuicaoDeCampanha, origemDe, type AtribuicaoDeps } from './atribuicao-campanha.js';

const clock = { now: () => new Date('2026-08-12T12:00:00.000Z') };

function deps(over: Partial<AtribuicaoDeps> = {}): AtribuicaoDeps {
  return {
    clock,
    contatos: () => Promise.resolve([]),
    inicioDaConversa: () => Promise.resolve([]),
    comHiscon: () => Promise.resolve(new Set()),
    confirmados: () => Promise.resolve(new Set()),
    fechados: () => Promise.resolve(new Set()),
    ...over,
  };
}

describe('origemDe', () => {
  it('lê a marca que a landing escreve na primeira mensagem', () => {
    expect(
      origemDe(['Olá! Vim pelo site (google-ads) e quero entender meu benefício do INSS.']),
    ).toBe('google-ads');
  });

  it('acha a marca mesmo que ela não seja a primeira linha', () => {
    expect(origemDe(['oi', 'Vim pelo site (Black-Friday) e quero saber'])).toBe('black-friday');
  });

  it('devolve null quando o cliente chegou por fora da landing', () => {
    expect(origemDe(['bom dia, quero saber sobre meu empréstimo'])).toBeNull();
    expect(origemDe([])).toBeNull();
  });
});

describe('AtribuicaoDeCampanha', () => {
  const base = deps({
    contatos: () =>
      Promise.resolve([
        { chatId: 'c1', clienteId: 'cli-1' },
        { chatId: 'c2', clienteId: 'cli-2' },
        { chatId: 'c3', clienteId: 'cli-3' },
        { chatId: 'c4', clienteId: 'c4' }, // sem cadastro e sem marca de origem
      ]),
    inicioDaConversa: (chatId) =>
      Promise.resolve(
        chatId === 'c4'
          ? ['bom dia, me indicaram vocês']
          : chatId === 'c3'
            ? ['Olá! Vim pelo site (meta-ads) e quero entender meu benefício do INSS.']
            : ['Olá! Vim pelo site (google-ads) e quero entender meu benefício do INSS.'],
      ),
    comHiscon: () => Promise.resolve(new Set(['c1', 'c2', 'c3'])),
    confirmados: () => Promise.resolve(new Set(['cli-1', 'cli-3'])),
    fechados: () => Promise.resolve(new Set(['c1'])),
  });

  it('conta cada origem ao longo do funil inteiro', async () => {
    const r = await new AtribuicaoDeCampanha(base).gerar();
    const google = r.linhas.find((l) => l.origem === 'google-ads');
    expect(google).toMatchObject({
      rotulo: 'Google Ads',
      contatos: 2,
      entregaramHiscon: 2,
      confirmaram: 1,
      fecharam: 1,
      taxaDeFechamento: 50,
    });
    const meta = r.linhas.find((l) => l.origem === 'meta-ads');
    expect(meta).toMatchObject({ contatos: 1, confirmaram: 1, fecharam: 0 });
  });

  it('ordena por quem FECHA, não por quem traz mais gente', async () => {
    const r = await new AtribuicaoDeCampanha(base).gerar();
    expect(r.linhas[0]?.origem).toBe('google-ads');
  });

  it('mostra o tamanho do que a atribuição não alcança', async () => {
    const r = await new AtribuicaoDeCampanha(base).gerar();
    expect(r.semOrigem).toBe(1); // o c4 veio por indicação
    expect(r.disponivel).toBe(true);
  });

  it('base sem nenhuma marca de origem continua indisponível (nada inventado)', async () => {
    const r = await new AtribuicaoDeCampanha(
      deps({
        contatos: () => Promise.resolve([{ chatId: 'c1', clienteId: 'cli-1' }]),
        inicioDaConversa: () => Promise.resolve(['oi']),
      }),
    ).gerar();
    expect(r.disponivel).toBe(false);
    expect(r.linhas).toEqual([]);
    expect(r.semOrigem).toBe(1);
  });
});
