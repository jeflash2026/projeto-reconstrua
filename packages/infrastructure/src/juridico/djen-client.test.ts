// DJEN (2026-09-10) — o item abaixo tem o FORMATO REAL que a API do CNJ
// devolveu para um processo do eproc do TJSP (texto encurtado).
import { describe, it, expect } from 'vitest';
import { DjenClient, publicacoesDoCorpo, textoDoHtml } from './djen-client.js';

const ITEM_REAL = {
  id: 713096462,
  data_disponibilizacao: '2026-08-31',
  siglaTribunal: 'TJSP',
  tipoComunicacao: 'Intimação',
  nomeOrgao: "UPJ da 1ª a 3ª  Varas Cível da Comarca de Santa Bárbara d'Oeste",
  nomeClasse: 'EXIBIçãO DE DOCUMENTO OU COISA CíVEL',
  texto:
    '<section><b>Exibi&ccedil;&atilde;o de Documento N&ordm; 4005177-19.2026.8.26.0533/SP</b></section>' +
    '<section><p>Vistos.</p><p>no prazo de 15 (quinze)&nbsp;dias.</p></section>',
  link: 'https://eproc1g.tjsp.jus.br/eproc/x',
  ativo: true,
  hash: 'voGJ',
};

describe('textoDoHtml', () => {
  it('decodifica acentos, ordinal e nbsp; parágrafos viram quebra de linha', () => {
    expect(textoDoHtml(ITEM_REAL.texto)).toBe(
      'Exibição de Documento Nº 4005177-19.2026.8.26.0533/SP\nVistos.\nno prazo de 15 (quinze) dias.',
    );
  });
});

describe('publicacoesDoCorpo', () => {
  it('lê o item real: classe normalizada, órgão sem espaço duplo, cancelada fica fora', () => {
    const pubs = publicacoesDoCorpo({
      status: 'success',
      count: 2,
      items: [ITEM_REAL, { ...ITEM_REAL, id: 1, ativo: false }],
    });
    expect(pubs).toHaveLength(1);
    expect(pubs[0]).toMatchObject({
      id: '713096462',
      data: '2026-08-31',
      tribunal: 'TJSP',
      tipo: 'Intimação',
      classe: 'EXIBIÇÃO DE DOCUMENTO OU COISA CÍVEL',
      orgao: "UPJ da 1ª a 3ª Varas Cível da Comarca de Santa Bárbara d'Oeste",
      link: 'https://eproc1g.tjsp.jus.br/eproc/x',
    });
    expect(publicacoesDoCorpo({ erro: 'qualquer' })).toEqual([]);
  });
});

describe('DjenClient', () => {
  it('manda o número só com dígitos e a chave do relay; 403 vira erro literal', async () => {
    const chamadas: { url: string; headers: Record<string, string> }[] = [];
    const fetchOk: typeof fetch = (url, init) => {
      const alvo = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      chamadas.push({ url: alvo, headers: (init?.headers ?? {}) as Record<string, string> });
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'success', count: 1, items: [ITEM_REAL] }), {
          status: 200,
        }),
      );
    };
    const cliente = new DjenClient(
      {
        url: 'https://corvo.teste/api/integracao/djen/comunicacao',
        headers: { 'X-Api-Key': 'k' },
      },
      fetchOk,
    );
    expect(await cliente.consultar('4005177-19.2026.8.26.0533')).toHaveLength(1);
    expect(chamadas[0]?.url).toBe(
      'https://corvo.teste/api/integracao/djen/comunicacao?numeroProcesso=40051771920268260533&itensPorPagina=50',
    );
    expect(chamadas[0]?.headers['X-Api-Key']).toBe('k');

    const negado = new DjenClient({ url: 'https://x', headers: {} }, () =>
      Promise.resolve(new Response('{}', { status: 403 })),
    );
    await expect(negado.consultar('4005177-19.2026.8.26.0533')).rejects.toThrow('HTTP 403');
  });
});

// RITMO (2026-09-11, nota do Corvo): o CNJ aceita 20 consultas/min por IP e
// todas saem do relay — ~3,5 s entre consultas; 429/502 com Retry-After curto
// repete o MESMO processo; pausa longa não é insistida.
describe('DjenClient — ritmo do relay', () => {
  const PROCESSO = '4005177-19.2026.8.26.0533';
  const ok = (): Response => new Response(JSON.stringify({ items: [ITEM_REAL] }), { status: 200 });
  const alvo = (url: Parameters<typeof fetch>[0]): string =>
    typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

  function relogio(): {
    esperas: number[];
    agora: () => number;
    dormir: (ms: number) => Promise<void>;
    avancar: (ms: number) => void;
  } {
    let t = 1_000_000;
    const esperas: number[] = [];
    return {
      esperas,
      agora: () => t,
      dormir: (ms) => {
        esperas.push(ms);
        t += ms;
        return Promise.resolve();
      },
      avancar: (ms) => {
        t += ms;
      },
    };
  }

  it('espaça as consultas em 3,5 s (desconta o tempo que já passou)', async () => {
    const r = relogio();
    const cliente = new DjenClient(
      { url: 'https://x', headers: {} },
      () => Promise.resolve(ok()),
      r,
    );
    await cliente.consultar(PROCESSO);
    r.avancar(1_000); // DataJud e o resto da volta levaram 1 s
    await cliente.consultar(PROCESSO);
    expect(r.esperas).toEqual([2_500]);
  });

  it('429 com Retry-After curto: espera e repete o MESMO processo', async () => {
    const r = relogio();
    const respostas = [
      new Response('{"erro":"limite"}', { status: 429, headers: { 'retry-after': '12' } }),
      ok(),
    ];
    const urls: string[] = [];
    const cliente = new DjenClient(
      { url: 'https://x', headers: {} },
      (url) => {
        urls.push(alvo(url));
        return Promise.resolve(respostas.shift() ?? ok());
      },
      r,
    );
    expect(await cliente.consultar(PROCESSO)).toHaveLength(1);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toBe(urls[0]);
    expect(r.esperas).toEqual([12_000]);
  });

  it('pausa longa do relay: não insiste até ela passar', async () => {
    const r = relogio();
    let chamadas = 0;
    const cliente = new DjenClient(
      { url: 'https://x', headers: {} },
      () => {
        chamadas += 1;
        return Promise.resolve(
          new Response('{"erro":"pausado"}', { status: 502, headers: { 'retry-after': '900' } }),
        );
      },
      r,
    );
    await expect(cliente.consultar(PROCESSO)).rejects.toThrow('HTTP 502');
    await expect(cliente.consultar(PROCESSO)).rejects.toThrow('em pausa pelo relay');
    expect(chamadas).toBe(1);
    r.avancar(900_000);
    await expect(cliente.consultar(PROCESSO)).rejects.toThrow('HTTP 502');
    expect(chamadas).toBe(2);
  });

  it('502 sem Retry-After (timeout do CNJ): erro na hora, sem repetir', async () => {
    const r = relogio();
    let chamadas = 0;
    const cliente = new DjenClient(
      { url: 'https://x', headers: {} },
      () => {
        chamadas += 1;
        return Promise.resolve(new Response('{"erro":"timeout"}', { status: 502 }));
      },
      r,
    );
    await expect(cliente.consultar(PROCESSO)).rejects.toThrow('HTTP 502');
    expect(chamadas).toBe(1);
    expect(r.esperas).toEqual([]);
  });
});
