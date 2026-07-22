// ─────────────────────────────────────────────────────────────────────────────
// JORNADA (R2/R3) — testes das rotas: lista derivada, definir modalidade e vender.
// Op fake mínimo (mesmo padrão de whatsapp-routes): as rotas só orquestram; a
// derivação/validação de negócio é testada em application/infrastructure.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AssembledAdminOperation } from '@reconstrua/infrastructure';
import type {
  ClienteResumo,
  ModalidadeRecord,
  PedidosAdministrativosRecord,
  ScheduledTask,
  VendaRecord,
} from '@reconstrua/application';
import { buildAdminServer } from './admin-server.js';

const ADMIN = 'TEST-ADMIN-SECRET';
const NOW = new Date('2026-07-18T12:00:00.000Z');

function resumo(over: Partial<ClienteResumo>): ClienteResumo {
  return {
    clienteId: 'cli-1',
    chatId: 'c1',
    missionId: 'm1',
    quem: 'Maria',
    status: 'PRONTO_AGUARDANDO_VENDA',
    modalidade: 'VENDA',
    pronto: true,
    faltando: [],
    saude: 'GREEN',
    ultimoContatoAt: NOW,
    pedidosConfirmadosEm: null,
    ...over,
  };
}

interface Harness {
  readonly app: FastifyInstance;
  readonly modalidades: ModalidadeRecord[];
  readonly vendas: VendaRecord[];
  readonly pedidos: PedidosAdministrativosRecord[];
  readonly agendadas: Array<Omit<ScheduledTask, 'status'>>;
  readonly closes: string[];
  drains: number;
}

function harness(clientes: readonly ClienteResumo[]): Harness {
  const modalidades: ModalidadeRecord[] = [];
  const vendas: VendaRecord[] = [];
  const pedidos: PedidosAdministrativosRecord[] = [];
  const agendadas: Array<Omit<ScheduledTask, 'status'>> = [];
  const closes: string[] = [];
  const state = { drains: 0 };
  const op = {
    clientes: {
      list: () => Promise.resolve(clientes),
      prontosParaVenda: () =>
        Promise.resolve(clientes.filter((c) => c.status === 'PRONTO_AGUARDANDO_VENDA')),
    },
    modalidadeStore: {
      load: () => Promise.resolve(null),
      save: (r: ModalidadeRecord) => {
        modalidades.push(r);
        return Promise.resolve();
      },
    },
    vendaStore: {
      load: () => Promise.resolve(null),
      save: (r: VendaRecord) => {
        vendas.push(r);
        return Promise.resolve();
      },
    },
    mission: {
      execute: (envelope: { chatId: string }) => {
        closes.push(envelope.chatId);
        return Promise.resolve({
          outcomes: [{ useCase: 'CloseMission', ok: true, skipped: false, streamId: 's1' }],
        });
      },
    },
    outbox: {
      drainToIdle: () => {
        state.drains += 1;
        return Promise.resolve();
      },
    },
    // B-R3 — fato + consequência (fakes de captura)
    pedidosStore: {
      load: () => Promise.resolve(null),
      save: (r: PedidosAdministrativosRecord) => {
        pedidos.push(r);
        return Promise.resolve();
      },
    },
    scheduler: {
      schedule: (t: Omit<ScheduledTask, 'status'>) => {
        agendadas.push(t);
        return Promise.resolve({ ...t, status: 'pending' });
      },
    },
    // B-R2 — visão do Perito (fake mínimo; a lógica real é testada em application)
    perito: {
      contratos: (clienteId: string) =>
        Promise.resolve(
          clientes.some((c) => c.clienteId === clienteId)
            ? {
                clienteId,
                chatId: 'c1',
                quem: 'Maria',
                parse: { contratos: [], foraDaJanela: [], naoReconhecidas: [], porBanco: {} },
                documentosLidos: 1,
                documentosSemTexto: 0,
              }
            : null,
        ),
      planilha: (clienteId: string) =>
        Promise.resolve(
          clientes.some((c) => c.clienteId === clienteId)
            ? {
                clienteId,
                quem: 'Maria',
                nomeArquivo: `contratos-${clienteId}.csv`,
                mime: 'text/csv; charset=utf-8',
                conteudo: 'A;B\r\n',
              }
            : null,
        ),
      planilhasDaFila: () =>
        Promise.resolve(
          clientes
            .filter((c) => c.status === 'PRONTO_AGUARDANDO_PERICIA')
            .map((c) => ({
              clienteId: c.clienteId,
              quem: c.quem,
              nomeArquivo: `contratos-${c.clienteId}.csv`,
              mime: 'text/csv; charset=utf-8',
              conteudo: 'A;B\r\n',
            })),
        ),
    },
  } as unknown as AssembledAdminOperation;
  const app = buildAdminServer(op, { accessSecret: ADMIN });
  return {
    app,
    modalidades,
    vendas,
    pedidos,
    agendadas,
    closes,
    get drains() {
      return state.drains;
    },
    set drains(v: number) {
      state.drains = v;
    },
  };
}

function call(
  app: FastifyInstance,
  opts: { method: 'GET' | 'POST'; url: string; payload?: object },
) {
  return app.inject({ ...opts, headers: { authorization: `Bearer ${ADMIN}` } });
}

describe('Jornada · rotas', () => {
  let h: Harness;
  beforeEach(() => {
    h = harness([
      resumo({}),
      resumo({
        clienteId: 'novo@c.us',
        chatId: 'novo@c.us',
        status: 'ATENDIMENTO',
        modalidade: null,
        pronto: false,
      }),
      resumo({
        clienteId: 'cli-2',
        chatId: 'c2',
        status: 'PRONTO_AGUARDANDO_MODALIDADE',
        modalidade: null,
      }),
      resumo({ clienteId: 'cli-3', chatId: 'c3', status: 'VENDIDO' }),
    ]);
  });

  it('exige autenticação (401 sem Bearer)', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/admin/jornada/clientes' });
    expect(res.statusCode).toBe(401);
  });

  it('GET lista e fila de venda', async () => {
    const todos = await call(h.app, { method: 'GET', url: '/admin/jornada/clientes' });
    expect(todos.statusCode).toBe(200);
    const bodyTodos: { clientes: ClienteResumo[] } = todos.json();
    expect(bodyTodos.clientes).toHaveLength(4);

    const fila = await call(h.app, { method: 'GET', url: '/admin/jornada/clientes?fila=venda' });
    const bodyFila: { clientes: ClienteResumo[] } = fila.json();
    expect(bodyFila.clientes).toHaveLength(1);
    expect(bodyFila.clientes[0]?.clienteId).toBe('cli-1');
  });

  it('B-R4 — fila=socio devolve apenas AGUARDANDO_SOCIO (prazo vencido)', async () => {
    const h4 = harness([
      resumo({}),
      resumo({
        clienteId: 'cli-s',
        chatId: 'cs',
        status: 'AGUARDANDO_SOCIO',
        modalidade: 'SOCIEDADE',
      }),
      resumo({ clienteId: 'cli-10', status: 'AGUARDANDO_10_DIAS', modalidade: 'SOCIEDADE' }),
    ]);
    const res = await call(h4.app, { method: 'GET', url: '/admin/jornada/clientes?fila=socio' });
    const body: { clientes: ClienteResumo[] } = res.json();
    expect(body.clientes).toHaveLength(1);
    expect(body.clientes[0]?.clienteId).toBe('cli-s');
  });

  it('B-R2 — fila=pericia filtra e as rotas do perito respondem', async () => {
    const h2 = harness([
      resumo({
        clienteId: 'cli-p',
        chatId: 'cp',
        status: 'PRONTO_AGUARDANDO_PERICIA',
        modalidade: 'SOCIEDADE',
      }),
      resumo({}),
    ]);
    const fila = await call(h2.app, { method: 'GET', url: '/admin/jornada/clientes?fila=pericia' });
    const bodyFila: { clientes: ClienteResumo[] } = fila.json();
    expect(bodyFila.clientes).toHaveLength(1);
    expect(bodyFila.clientes[0]?.clienteId).toBe('cli-p');

    const contratos = await call(h2.app, {
      method: 'GET',
      url: '/admin/jornada/pericia/cli-p/contratos',
    });
    expect(contratos.statusCode).toBe(200);
    const naoExiste = await call(h2.app, {
      method: 'GET',
      url: '/admin/jornada/pericia/zzz/contratos',
    });
    expect(naoExiste.statusCode).toBe(404);

    const planilha = await call(h2.app, {
      method: 'GET',
      url: '/admin/jornada/pericia/cli-p/planilha',
    });
    expect(planilha.statusCode).toBe(200);
    expect(planilha.headers['content-type']).toContain('text/csv');
    expect(planilha.headers['content-disposition']).toContain('contratos-cli-p.csv');

    const lote = await call(h2.app, { method: 'GET', url: '/admin/jornada/pericia/planilhas' });
    const bodyLote: { planilhas: Array<{ nomeArquivo: string }> } = lote.json();
    expect(bodyLote.planilhas).toHaveLength(1);
    expect(bodyLote.planilhas[0]?.nomeArquivo).toBe('contratos-cli-p.csv');
  });

  it('POST modalidade — valida entrada, reconhecimento e grava o marcador', async () => {
    const invalida = await call(h.app, {
      method: 'POST',
      url: '/admin/jornada/clientes/cli-2/modalidade',
      payload: { modalidade: 'OUTRA' },
    });
    expect(invalida.statusCode).toBe(400);

    const inexistente = await call(h.app, {
      method: 'POST',
      url: '/admin/jornada/clientes/nao-existe/modalidade',
      payload: { modalidade: 'VENDA' },
    });
    expect(inexistente.statusCode).toBe(404);

    const naoReconhecido = await call(h.app, {
      method: 'POST',
      url: '/admin/jornada/clientes/novo@c.us/modalidade',
      payload: { modalidade: 'VENDA' },
    });
    expect(naoReconhecido.statusCode).toBe(409);

    const ok = await call(h.app, {
      method: 'POST',
      url: '/admin/jornada/clientes/cli-2/modalidade',
      payload: { modalidade: 'SOCIEDADE', decididaPor: 'ceo' },
    });
    expect(ok.statusCode).toBe(200);
    expect(h.modalidades).toHaveLength(1);
    expect(h.modalidades[0]?.modalidade).toBe('SOCIEDADE');
    expect(h.modalidades[0]?.decididaPor).toBe('ceo');
  });

  it('B-R3 — confirmar pedidos: guarda de fila, grava o FATO e agenda a consequência (Lei 8)', async () => {
    const h3 = harness([
      resumo({
        clienteId: 'cli-p',
        chatId: 'cp',
        missionId: 'mp',
        status: 'PRONTO_AGUARDANDO_PERICIA',
        modalidade: 'SOCIEDADE',
      }),
      resumo({}),
      resumo({ clienteId: 'cli-10d', status: 'AGUARDANDO_10_DIAS', modalidade: 'SOCIEDADE' }),
    ]);

    const foraDaFila = await call(h3.app, {
      method: 'POST',
      url: '/admin/jornada/pericia/cli-1/confirmar-pedidos',
      payload: {},
    });
    expect(foraDaFila.statusCode).toBe(409); // está na fila de VENDA, não da perícia

    const jaConfirmado = await call(h3.app, {
      method: 'POST',
      url: '/admin/jornada/pericia/cli-10d/confirmar-pedidos',
      payload: {},
    });
    expect(jaConfirmado.statusCode).toBe(409);

    const inexistente = await call(h3.app, {
      method: 'POST',
      url: '/admin/jornada/pericia/zzz/confirmar-pedidos',
      payload: {},
    });
    expect(inexistente.statusCode).toBe(404);

    const ok = await call(h3.app, {
      method: 'POST',
      url: '/admin/jornada/pericia/cli-p/confirmar-pedidos',
      payload: { confirmadoPor: 'perito-ana' },
    });
    expect(ok.statusCode).toBe(200);
    const body: { confirmado: boolean; prazoAte: string } = ok.json();
    expect(body.confirmado).toBe(true);

    // O FATO: autoria + rastreabilidade (Lei 10).
    expect(h3.pedidos).toHaveLength(1);
    expect(h3.pedidos[0]?.confirmadoPor).toBe('perito-ana');
    expect(h3.pedidos[0]?.chatId).toBe('cp');

    // A CONSEQUÊNCIA: tarefa idempotente no scheduler existente, 10 dias (Lei 8).
    expect(h3.agendadas).toHaveLength(1);
    expect(h3.agendadas[0]?.id).toBe('pedidos-adm:cli-p');
    expect(h3.agendadas[0]?.kind).toBe('follow_deadline');
    const dueMs = h3.agendadas[0]!.dueAt.getTime() - h3.pedidos[0]!.confirmadoEm.getTime();
    expect(dueMs).toBe(10 * 24 * 60 * 60 * 1000);
    expect(new Date(body.prazoAte).getTime()).toBe(h3.agendadas[0]!.dueAt.getTime());
  });

  it('POST vender — guarda de status, registra a venda e encerra pelo caminho existente', async () => {
    const semComprador = await call(h.app, {
      method: 'POST',
      url: '/admin/jornada/clientes/cli-1/vender',
      payload: {},
    });
    expect(semComprador.statusCode).toBe(400);

    const naoPronto = await call(h.app, {
      method: 'POST',
      url: '/admin/jornada/clientes/cli-2/vender',
      payload: { comprador: 'Dr. X' },
    });
    expect(naoPronto.statusCode).toBe(409);

    const jaVendido = await call(h.app, {
      method: 'POST',
      url: '/admin/jornada/clientes/cli-3/vender',
      payload: { comprador: 'Dr. X' },
    });
    expect(jaVendido.statusCode).toBe(409);

    const ok = await call(h.app, {
      method: 'POST',
      url: '/admin/jornada/clientes/cli-1/vender',
      payload: { comprador: 'Escritório X', vendidaPor: 'ceo' },
    });
    expect(ok.statusCode).toBe(200);
    const body: { vendido: boolean; comprador: string } = ok.json();
    expect(body.vendido).toBe(true);
    expect(h.vendas).toHaveLength(1);
    expect(h.vendas[0]?.comprador).toBe('Escritório X');
    expect(h.vendas[0]?.chatId).toBe('c1');
    expect(h.closes).toEqual(['c1']); // CloseMission pelo MESMO caminho de /encerrar
    expect(h.drains).toBe(1); // read models projetados imediatamente
  });
});
