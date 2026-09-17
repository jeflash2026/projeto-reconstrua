// PROCESSOS DISTRIBUÍDOS NO DIA (2026-09-10) — o card do dashboard jurídico:
// processo = nº CNJ, conta no dia (Brasília) do PRIMEIRO contrato cadastrado.
import { describe, it, expect } from 'vitest';
import { diaEmBrasilia, distribuidosNoDia, type ContratoJuridico } from './juridico-service.js';

function contrato(p: Partial<ContratoJuridico>): ContratoJuridico {
  return {
    id: 'jt-1',
    clienteId: 'jc-1',
    processoNumero: '4002387-95.2026.8.26.0619',
    banco: 'PICPAY BANK',
    numero: 's/nº',
    valor: null,
    assinatura: null,
    inicio: null,
    fimPrevisto: null,
    observacoes: '',
    status: 'ativo',
    encerramento: null,
    exclusao: null,
    anexos: [],
    historico: [],
    criadoPor: 'AHRI (Jarvis)',
    em: '2026-09-10T20:40:00.000Z',
    atualizadoEm: '2026-09-10T20:40:00.000Z',
    ...p,
  };
}

describe('diaEmBrasilia', () => {
  it('01:30 UTC ainda é o dia ANTERIOR em Brasília; 03:30 UTC já é o seguinte', () => {
    expect(diaEmBrasilia(new Date('2026-09-11T01:30:00.000Z'))).toBe('2026-09-10');
    expect(diaEmBrasilia(new Date('2026-09-11T03:30:00.000Z'))).toBe('2026-09-11');
  });
});

describe('distribuidosNoDia', () => {
  it('conta processos (não contratos) do dia, pelo PRIMEIRO cadastro, sem os excluídos', () => {
    const agora = new Date('2026-09-11T02:00:00.000Z'); // 23:00 de 10/09 em Brasília
    const nomes = new Map([
      ['jc-1', 'Gildete dos Santos Teixeira'],
      ['jc-2', 'Jose Rodrigues'],
    ]);
    const r = distribuidosNoDia(
      [
        // Hoje: conta.
        contrato({ id: 'a', processoNumero: '4002387-95.2026.8.26.0619' }),
        // Hoje, DOIS contratos no mesmo processo: conta UMA vez.
        contrato({ id: 'b1', clienteId: 'jc-2', processoNumero: '4002412-11.2026.8.26.0619' }),
        contrato({
          id: 'b2',
          clienteId: 'jc-2',
          processoNumero: '4002412-11.2026.8.26.0619',
          em: '2026-09-10T20:41:00.000Z',
        }),
        // 22:00 de 10/09 em Brasília (já 11/09 em UTC): conta.
        contrato({
          id: 'f',
          processoNumero: '4002386-13.2026.8.26.0619',
          banco: 'PARANÁ BANCO',
          em: '2026-09-11T01:00:00.000Z',
        }),
        // Ontem em Brasília (23:00 de 09/09): não conta.
        contrato({
          id: 'c',
          processoNumero: '4002385-28.2026.8.26.0619',
          em: '2026-09-10T02:00:00.000Z',
        }),
        // Processo que nasceu ontem e ganhou contrato hoje: não conta de novo.
        contrato({
          id: 'd1',
          processoNumero: '4002400-94.2026.8.26.0619',
          em: '2026-09-09T15:00:00.000Z',
        }),
        contrato({ id: 'd2', processoNumero: '4002400-94.2026.8.26.0619' }),
        // Excluído hoje: fora.
        contrato({ id: 'e', processoNumero: '4002401-79.2026.8.26.0619', status: 'excluido' }),
      ],
      nomes,
      agora,
    );
    expect(r.dia).toBe('2026-09-10');
    expect(r.processos).toBe(3);
    expect(r.clientes).toBe(2);
    // Mais recente primeiro; nome do cliente resolvido.
    expect(r.itens.map((i) => i.processo)).toEqual([
      '4002386-13.2026.8.26.0619',
      '4002387-95.2026.8.26.0619',
      '4002412-11.2026.8.26.0619',
    ]);
    expect(r.itens[0]).toMatchObject({
      banco: 'PARANÁ BANCO',
      clienteNome: 'Gildete dos Santos Teixeira',
    });
  });

  it('dia sem cadastro ⇒ zero, lista vazia', () => {
    const r = distribuidosNoDia([], new Map(), new Date('2026-09-10T15:00:00.000Z'));
    expect(r).toEqual({ dia: '2026-09-10', processos: 0, clientes: 0, itens: [] });
  });
});

// ── DataJud + DJEN (2026-09-10): o eproc do TJSP não chega ao DataJud; as
// publicações do DJEN entram como movimentos (texto + link), com alerta de
// intimação no dashboard e item na fila de visto. ──────────────────────────
import { InMemoryJsonStore } from '../production/json-store.js';
import type { MediaStorePort } from '../media/media-store-port.js';
import type { PublicacaoDjen } from './djen-client.js';
import { JuridicoService } from './juridico-service.js';

describe('atualizarAndamentos — DataJud sem o processo, DJEN com as publicações', () => {
  function montar(djen: {
    consultar(n: string): Promise<readonly PublicacaoDjen[]>;
  }): JuridicoService {
    return new JuridicoService({
      json: new InMemoryJsonStore(),
      media: {} as MediaStorePort,
      clock: { now: () => new Date('2026-09-10T20:00:00.000Z') },
      datajud: { consultar: () => Promise.resolve(null) },
      djen,
    });
  }
  async function comProcesso(svc: JuridicoService): Promise<void> {
    const c = await svc.criarCliente({ nome: 'Taís Regina Caetano da Silva' }, 'teste');
    if (!c.ok) throw new Error('cliente não criado');
    await svc.criarProcesso(
      {
        clienteId: c.valor,
        numero: '4005177-19.2026.8.26.0533',
        bancos: [{ banco: 'BANCO AGIBANK', contratos: [{ numero: 's/nº' }] }],
      },
      'teste',
    );
  }
  const PUBS: readonly PublicacaoDjen[] = [
    {
      id: '2',
      data: '2026-08-31',
      tribunal: 'TJSP',
      tipo: 'Intimação',
      orgao: 'UPJ da 1ª a 3ª Varas Cível da Comarca de Santa Bárbara d’Oeste',
      classe: 'EXIBIÇÃO DE DOCUMENTO OU COISA CÍVEL',
      texto: 'DESPACHO/DECISÃO\nVistos.\nno prazo de 15 (quinze) dias.',
      link: 'https://eproc1g.tjsp.jus.br/x',
    },
    {
      id: '1',
      data: '2026-08-31',
      tribunal: 'TJSP',
      tipo: 'Lista de distribuição',
      orgao: 'UPJ da 1ª a 3ª Varas Cível da Comarca de Santa Bárbara d’Oeste',
      classe: 'EXIBIÇÃO DE DOCUMENTO OU COISA CÍVEL',
      texto: 'Processo distribuído na data de 27/08/2026.',
      link: null,
    },
  ];

  it('vira encontrado: capa e movimentos do DJEN, fila com o texto, alerta de intimação; rodar de novo não duplica', async () => {
    const svc = montar({ consultar: () => Promise.resolve(PUBS) });
    await comProcesso(svc);
    expect(await svc.atualizarAndamentos()).toMatchObject({
      ok: true,
      consultados: 1,
      encontrados: 1,
      erros: 0,
    });
    const [a] = await svc.listarAndamentos();
    expect(a?.erro).toBeNull();
    expect(a?.tribunal).toBe('TJSP');
    expect(a?.classe).toBe('EXIBIÇÃO DE DOCUMENTO OU COISA CÍVEL');
    expect(a?.movimentos.map((m) => m.nome)).toEqual([
      'DJEN · Intimação',
      'DJEN · Lista de distribuição',
    ]);
    expect(a?.movimentos[0]?.texto).toContain('15 (quinze) dias');

    const [item] = await svc.filaMovimentacoes();
    expect(item?.pendente).toBe(true);
    expect(item?.naoVistos[0]?.link).toBe('https://eproc1g.tjsp.jus.br/x');

    const d = await svc.dashboard();
    expect(d.alertas[0]).toMatchObject({
      tipo: '📬 Intimação',
      clienteNome: 'Taís Regina Caetano da Silva',
    });

    // Segunda rodada com as MESMAS publicações: nada duplica, nada é "novidade".
    expect(await svc.atualizarAndamentos()).toMatchObject({ novidades: 0 });
    const [b] = await svc.listarAndamentos();
    expect(b?.movimentos).toHaveLength(2);
  });

  it('DJEN fora do ar e DataJud sem o processo ⇒ erro LITERAL do DJEN na tela', async () => {
    const svc = montar({ consultar: () => Promise.reject(new Error('DJEN respondeu HTTP 404')) });
    await comProcesso(svc);
    expect(await svc.atualizarAndamentos()).toMatchObject({ ok: true, encontrados: 0, erros: 1 });
    const [a] = await svc.listarAndamentos();
    expect(a?.erro).toContain('HTTP 404');
  });

  // 2026-09-11: o relay do DJEN limita as consultas do CNJ por IP — o job de
  // 6h e o botão não podem rodar duas rodadas ao mesmo tempo.
  it('uma rodada por vez: quem chama durante a rodada recebe a MESMA; o status acompanha', async () => {
    let consultas = 0;
    let liberar: () => void = () => undefined;
    const trava = new Promise<void>((r) => {
      liberar = r;
    });
    const svc = montar({
      consultar: async () => {
        consultas += 1;
        await trava;
        return PUBS;
      },
    });
    await comProcesso(svc);
    const primeira = svc.atualizarAndamentos();
    const segunda = svc.atualizarAndamentos();
    expect(segunda).toBe(primeira);
    expect(svc.statusAtualizacao()).toMatchObject({ atualizando: true, ultima: null });
    liberar();
    expect(await primeira).toMatchObject({ ok: true, consultados: 1 });
    expect(consultas).toBe(1);
    expect(svc.statusAtualizacao()).toMatchObject({
      atualizando: false,
      iniciadaEm: null,
      ultima: { ok: true, consultados: 1 },
    });
  });
});

// ── VALOR DA CARTEIRA (2026-09-17, pedido do dono): cada processo vale a BASE
// de R$ 10.000 até a execução dizer o valor real — que então substitui a base,
// para mais ou para menos. A parte da empresa é 49% do valor corrigido. ──────

describe('dashboard — valor base por processo e correção pelo valor real', () => {
  function servico(): JuridicoService {
    return new JuridicoService({
      json: new InMemoryJsonStore(),
      media: {} as MediaStorePort,
      clock: { now: () => new Date('2026-09-17T18:00:00.000Z') },
      datajud: { consultar: () => Promise.resolve(null) },
      djen: { consultar: () => Promise.resolve([]) },
    });
  }

  async function comTresProcessos(svc: JuridicoService): Promise<readonly string[]> {
    const c = await svc.criarCliente({ nome: 'Jose Luiz Malgradi' }, 'teste');
    if (!c.ok) throw new Error('cliente não criado');
    const numeros = [
      '4002400-94.2026.8.26.0619',
      '4002412-11.2026.8.26.0619',
      '4002419-03.2026.8.26.0619',
    ];
    for (const numero of numeros) {
      await svc.criarProcesso(
        {
          clienteId: c.valor,
          numero,
          bancos: [{ banco: 'BANCO PAN', contratos: [{ numero: 's/nº' }] }],
        },
        'teste',
      );
    }
    return numeros;
  }

  it('sem nenhum valor lançado: base = corrigido = 3 × 10 mil e empresa = 49%', async () => {
    const svc = servico();
    await comTresProcessos(svc);
    const d = await svc.dashboard();
    expect(d.processosAtivos).toBe(3);
    expect(d.valorBase).toBe(30_000);
    expect(d.valorAtivos).toBe(30_000);
    expect(d.comValorReal).toBe(0);
    expect(d.valorEmpresa).toBe(14_700);
    expect(d.parteDaEmpresa).toBe(0.49);
  });

  it('o valor real da execução substitui a base — para mais, para menos e zerando', async () => {
    const svc = servico();
    const [maior, menor, perdido] = await comTresProcessos(svc);
    expect(
      (
        await svc.registrarResultado(
          maior ?? '',
          { situacao: 'apurado', valorRecebido: 18_600 },
          'dono',
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await svc.registrarResultado(
          menor ?? '',
          { situacao: 'pago', valorRecebido: 6_400 },
          'dono',
        )
      ).ok,
    ).toBe(true);
    expect((await svc.registrarResultado(perdido ?? '', { situacao: 'perdido' }, 'dono')).ok).toBe(
      true,
    );
    const d = await svc.dashboard();
    // 18.600 (apurado) + 6.400 (pago) + 0 (sem êxito) — a base não entra em nenhum.
    expect(d.valorBase).toBe(30_000);
    expect(d.valorAtivos).toBe(25_000);
    expect(d.comValorReal).toBe(3);
    expect(d.valorEmpresa).toBe(12_250);
  });
});
