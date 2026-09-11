// ACOMPANHAMENTO PROCESSUAL NO PAINEL DO ADVOGADO (2026-09-11) — parecer por
// comunicação do DJEN, vencimento estimado em dias úteis e alertas por advogado.
import { describe, it, expect } from 'vitest';
import type { AndamentoProcesso, ClienteJuridico, ContratoJuridico } from './juridico-service.js';
import type { EntregaAoAdvogado } from './pastas-advogado.js';
import {
  AcompanhamentoProcessual,
  chaveDaComunicacao,
  ehDiaUtilForense,
  estimarVencimento,
  parseParecer,
  type ArmazemAcompanhamento,
  type DadosDoJuridico,
} from './acompanhamento-processual.js';

function memoria(): ArmazemAcompanhamento & { dados: Map<string, unknown> } {
  const dados = new Map<string, unknown>();
  return {
    dados,
    get: (ns, chave) => Promise.resolve(dados.get(`${ns}/${chave}`) ?? null),
    put: (ns, chave, valor) => {
      dados.set(`${ns}/${chave}`, valor);
      return Promise.resolve();
    },
    list: (ns) =>
      Promise.resolve(
        [...dados.entries()].filter(([k]) => k.startsWith(`${ns}/`)).map(([, v]) => v),
      ),
  };
}

// 11/09/2026 às 10h em Brasília.
const relogio = { now: () => new Date('2026-09-11T13:00:00.000Z') };

const TAIS = '4005177-19.2026.8.26.0533';
const GILDETE = '4002387-95.2026.8.26.0619';
const ADONIRAM = '4009999-11.2026.8.26.0100';

const TEXTO_TAIS =
  'Vistos. Intime-se a parte autora para, no prazo de 15 dias, comprovar o recebimento da notificação pelo banco e juntar documentos que comprovem a hipossuficiência, sob pena de indeferimento.';

const andamento = (
  numero: string,
  movimentos: AndamentoProcesso['movimentos'],
): AndamentoProcesso => ({
  numero,
  tribunal: 'TJSP',
  classe: 'PROCEDIMENTO COMUM CÍVEL',
  orgaoJulgador: '1ª Vara',
  assunto: '',
  grau: 'G1',
  dataAjuizamento: '',
  ultimoMovimento: movimentos[0] ?? null,
  movimentos,
  emExecucao: false,
  novidade: false,
  consultadoEm: '2026-09-11T10:32:00.000Z',
  erro: null,
});

const intimacaoTais = {
  nome: 'DJEN · Intimação',
  dataHora: '2026-08-31T12:00:00.000Z',
  texto: TEXTO_TAIS,
  link: null,
  fonte: 'DJEN' as const,
};

const andamentos: AndamentoProcesso[] = [
  andamento(TAIS, [
    intimacaoTais,
    // Lista de distribuição: sem ordem nenhuma, não gera parecer.
    {
      nome: 'DJEN · Lista de distribuição',
      dataHora: '2026-08-20T12:00:00.000Z',
      texto: 'Processo distribuído por sorteio à 1ª Vara Cível da comarca de Santa Bárbara.',
      fonte: 'DJEN' as const,
    },
    // DataJud: só o nome do movimento, sem texto.
    {
      nome: 'Conclusos para despacho',
      dataHora: '2026-08-25T12:00:00.000Z',
      fonte: 'DATAJUD' as const,
    },
  ]),
  andamento(ADONIRAM, [
    {
      nome: 'DJEN · Intimação',
      dataHora: '2026-09-09T12:00:00.000Z',
      texto:
        'Vistos. Cite-se o réu. Intime-se a parte autora para ciência do recebimento da inicial.',
      fonte: 'DJEN' as const,
    },
  ]),
];

const cliente = (id: string, nome: string): ClienteJuridico => ({ id, nome }) as ClienteJuridico;
const processo = (clienteId: string, numero: string, banco: string): ContratoJuridico =>
  ({ clienteId, processoNumero: numero, banco, status: 'ativo' }) as ContratoJuridico;

const entregas: EntregaAoAdvogado[] = [
  {
    advogadoId: 'a-gra',
    advogado: 'Gracielle',
    chatId: 'c-tais',
    nome: 'TAIS REGINA CAETANO DA SILVA',
    entregueEm: null,
  },
  {
    advogadoId: 'a-gra',
    advogado: 'Gracielle',
    chatId: 'c-gil',
    nome: 'GILDETE DOS SANTOS TEIXEIRA',
    entregueEm: null,
  },
  {
    advogadoId: 'a-cor',
    advogado: 'Cornélio',
    chatId: 'c-ado',
    nome: 'ADONIRAM APARECIDA PAULINO VIEIRA',
    entregueEm: null,
  },
];

const dados: DadosDoJuridico = {
  entregas,
  clientes: [
    cliente('j-tais', 'Taís Regina Caetano da Silva'),
    cliente('j-gil', 'Gildete dos Santos Teixeira'),
    cliente('j-ado', 'Adoniram Aparecida Paulino Vieira'),
  ],
  contratos: [
    processo('j-tais', TAIS, 'BRADESCO'),
    processo('j-tais', TAIS, 'PAN'),
    processo('j-gil', GILDETE, 'C6'),
    processo('j-ado', ADONIRAM, 'ITAU'),
  ],
  andamentos,
};

const PARECER_TAIS = JSON.stringify({
  resumo:
    'O juiz pediu prova de que o banco recebeu a notificação e prova da necessidade de justiça gratuita.',
  determinacoes: [
    {
      oQue: 'Comprovar o recebimento da notificação pelo banco',
      responsavel: 'advogado',
      prazoDias: 15,
      diasCorridos: false,
    },
    {
      oQue: 'Juntar documentos de hipossuficiência',
      responsavel: 'parte autora',
      prazoDias: 15,
      diasCorridos: false,
    },
  ],
  exigeAcao: true,
  proximoPasso: 'Juntar a resposta do banco ou a confirmação de entrega do e-mail.',
  tom: 'neutro',
});

describe('estimarVencimento (dias úteis a partir da publicação no DJEN)', () => {
  it('disponibilizado seg 31/08/2026, 15 dias úteis: pula fim de semana e o 07/09 → 23/09', () => {
    expect(estimarVencimento('2026-08-31', 15)).toBe('2026-09-23');
  });

  it('dias corridos contam tudo; vencimento em dia útil fica', () => {
    expect(estimarVencimento('2026-08-31', 10, true)).toBe('2026-09-11');
  });

  it('recesso de 20/12 a 20/01 suspende a contagem', () => {
    expect(estimarVencimento('2026-12-18', 5)).toBe('2027-01-28');
    expect(ehDiaUtilForense('2027-01-05')).toBe(false);
  });

  it('entrada inválida → null', () => {
    expect(estimarVencimento('31/08/2026', 15)).toBeNull();
    expect(estimarVencimento('2026-08-31', 0)).toBeNull();
    expect(estimarVencimento('2026-08-31', 2.5)).toBeNull();
  });
});

describe('parseParecer', () => {
  it('lê o JSON mesmo com texto em volta e valida os campos', () => {
    const p = parseParecer(`Segue:\n${PARECER_TAIS}\nFim.`);
    expect(p?.determinacoes.map((d) => d.prazoDias)).toEqual([15, 15]);
    expect(p?.tom).toBe('neutro');
  });

  it('prazo fora do escrito vira null; tom desconhecido vira neutro; prazo força exigeAcao', () => {
    const p = parseParecer(
      JSON.stringify({
        resumo: 'Despacho.',
        determinacoes: [
          { oQue: 'Emendar a inicial', responsavel: '', prazoDias: 15, diasCorridos: false },
          { oQue: 'Aguardar', prazoDias: 'quinze' },
          { oQue: '', prazoDias: 5 },
        ],
        exigeAcao: false,
        proximoPasso: 'Emendar.',
        tom: 'otimo',
      }),
    );
    expect(p?.determinacoes).toEqual([
      { oQue: 'Emendar a inicial', responsavel: 'advogado', prazoDias: 15, diasCorridos: false },
      { oQue: 'Aguardar', responsavel: 'advogado', prazoDias: null, diasCorridos: false },
    ]);
    expect(p?.exigeAcao).toBe(true);
    expect(p?.tom).toBe('neutro');
  });

  it('sem resumo ou sem JSON → null', () => {
    expect(parseParecer('{"determinacoes": []}')).toBeNull();
    expect(parseParecer('não sei')).toBeNull();
  });
});

describe('AcompanhamentoProcessual', () => {
  it('gera parecer só das comunicações do DJEN com ordem (fora a distribuição e o DataJud), uma vez', async () => {
    const json = memoria();
    const pedidos: string[] = [];
    const acompanhamento = new AcompanhamentoProcessual({
      json,
      clock: relogio,
      completar: (_system, user) => {
        pedidos.push(user);
        return Promise.resolve(PARECER_TAIS);
      },
    });
    expect(await acompanhamento.analisarPendentes(andamentos)).toEqual({
      analisadas: 2,
      erros: 0,
      restantes: 0,
    });
    expect(pedidos).toHaveLength(2);
    expect(
      pedidos.some((p) => p.includes('disponibilizada em 31/08/2026') && p.includes(TEXTO_TAIS)),
    ).toBe(true);
    // Segunda rodada: nada novo a pagar.
    expect(await acompanhamento.analisarPendentes(andamentos)).toEqual({
      analisadas: 0,
      erros: 0,
      restantes: 0,
    });
  });

  it('LLM offline: não analisa e conta o que ficou pendente', async () => {
    const acompanhamento = new AcompanhamentoProcessual({
      json: memoria(),
      clock: relogio,
      completar: null,
    });
    expect(await acompanhamento.analisarPendentes(andamentos)).toEqual({
      analisadas: 0,
      erros: 0,
      restantes: 2,
    });
  });

  it('resposta ilegível: tenta até 3 rodadas e desiste', async () => {
    let chamadas = 0;
    const acompanhamento = new AcompanhamentoProcessual({
      json: memoria(),
      clock: relogio,
      completar: () => {
        chamadas += 1;
        return Promise.resolve('não consegui');
      },
    });
    const soTais = [andamentos[0]!];
    for (let i = 0; i < 5; i += 1) await acompanhamento.analisarPendentes(soTais);
    expect(chamadas).toBe(3);
  });

  it('painel: só os clientes DELE, com parecer, vencimento estimado e alerta ordenado', async () => {
    const acompanhamento = new AcompanhamentoProcessual({
      json: memoria(),
      clock: relogio,
      completar: () => Promise.resolve(PARECER_TAIS),
    });
    await acompanhamento.analisarPendentes(andamentos);
    const painel = await acompanhamento.painelDoAdvogado('a-gra', dados);

    expect(painel.clientes.map((c) => [c.nome, c.alertas])).toEqual([
      ['Taís Regina Caetano da Silva', 1],
      ['Gildete dos Santos Teixeira', 0],
    ]);
    const tais = painel.clientes[0]!;
    expect(tais.processos[0]?.bancos).toEqual(['BRADESCO', 'PAN']);
    const [intimacao, distribuicao, datajud] = tais.processos[0]!.movimentos;
    expect(intimacao?.analise?.resumo).toContain('prova de que o banco recebeu');
    expect(distribuicao?.chave).toBeNull();
    expect(datajud?.analise).toBeNull();
    // Gildete: processo cadastrado, ainda sem consulta do acompanhamento.
    expect(painel.clientes[1]?.processos[0]).toMatchObject({
      numero: GILDETE,
      consultadoEm: null,
      movimentos: [],
    });

    expect(painel.alertas).toHaveLength(1);
    expect(painel.alertas[0]).toMatchObject({
      cliente: 'Taís Regina Caetano da Silva',
      processo: TAIS,
      vencimentoEstimado: '2026-09-23',
      diasRestantes: 12,
      vencido: false,
      ciente: false,
    });
    // O processo do Cornélio não aparece para a Gracielle.
    expect(painel.alertas.some((a) => a.processo === ADONIRAM)).toBe(false);
  });

  it('ciente: só em alerta dos seus processos; o alerta desce e para de contar', async () => {
    const acompanhamento = new AcompanhamentoProcessual({
      json: memoria(),
      clock: relogio,
      completar: () => Promise.resolve(PARECER_TAIS),
    });
    await acompanhamento.analisarPendentes(andamentos);
    const chaveTais = chaveDaComunicacao(TAIS, intimacaoTais);
    const chaveAdoniram = chaveDaComunicacao(ADONIRAM, andamentos[1]!.movimentos[0]!);

    expect(await acompanhamento.marcarCiente('a-gra', chaveAdoniram, dados)).toEqual({
      ok: false,
      error: 'alerta não encontrado entre os seus processos',
    });
    expect(await acompanhamento.marcarCiente('a-gra', chaveTais, dados)).toEqual({ ok: true });
    const painel = await acompanhamento.painelDoAdvogado('a-gra', dados);
    expect(painel.alertas[0]?.ciente).toBe(true);
    expect(painel.clientes.find((c) => c.chatId === 'c-tais')?.alertas).toBe(0);
    // O ciente é da Gracielle — não vale para outro advogado.
    const doCornelio = await acompanhamento.painelDoAdvogado('a-cor', dados);
    expect(doCornelio.alertas.every((a) => !a.ciente)).toBe(true);
  });

  it('prazo vencido há mais de 5 dias sai dos alertas', async () => {
    const depois = { now: () => new Date('2026-09-30T13:00:00.000Z') };
    const json = memoria();
    await new AcompanhamentoProcessual({
      json,
      clock: relogio,
      completar: () => Promise.resolve(PARECER_TAIS),
    }).analisarPendentes(andamentos);
    const aindaAparece = await new AcompanhamentoProcessual({
      json,
      clock: { now: () => new Date('2026-09-25T13:00:00.000Z') },
      completar: null,
    }).painelDoAdvogado('a-gra', dados);
    expect(aindaAparece.alertas[0]).toMatchObject({ vencido: true, diasRestantes: -2 });
    const saiu = await new AcompanhamentoProcessual({
      json,
      clock: depois,
      completar: null,
    }).painelDoAdvogado('a-gra', dados);
    expect(saiu.alertas).toHaveLength(0);
  });
});
