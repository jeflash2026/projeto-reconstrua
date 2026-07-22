// ─────────────────────────────────────────────────────────────────────────────
// CLIENTES (R2) — testes. Toda fila DERIVADA em leitura; único estado gravado é o
// marcador modalidade (por clienteId). Cobre a tabela de status do modelo congelado.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { emptyALIR, type ALIR } from '../alir/alir-contract.js';
import { emptyMemory, type ClientMemory } from '../living-memory/client-memory.js';
import type { MemoryStore } from '../living-memory/ports.js';
import type { ALIRComposition, ALIRCompositionMetrics } from '../alir/alir-projection-builder.js';
import type { ALIRComposer } from '../alir/alir-projection-builder.js';
import {
  ClientesList,
  deriveClienteStatus,
  prazoDosPedidos,
  type Modalidade,
  type ModalidadeRecord,
  type ModalidadeStore,
  type PedidosAdministrativosRecord,
  type PedidosAdministrativosStore,
  type VendaRecord,
  type VendaStore,
} from './clientes-list.js';
import { evaluateReadiness } from '../qualification/readiness.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

interface Cli {
  readonly chatId: string;
  readonly clienteId?: string;
  readonly missionId?: string | null;
  readonly terminal?: boolean;
  readonly pendentes?: readonly string[];
  readonly truth?: boolean;
  readonly nome?: string;
  readonly ultimoContato?: Date;
}

function alirOf(c: Cli): ALIR {
  const b = emptyALIR(c.clienteId ?? c.chatId, c.chatId, NOW);
  return {
    ...b,
    core:
      c.nome !== undefined
        ? { pessoa: { ...b.core.pessoa, atributos: [{ key: 'nome', value: c.nome }] } }
        : b.core,
    operational: {
      ...b.operational,
      missao: {
        ...b.operational.missao,
        missionId: c.missionId === undefined ? 'm-' + c.chatId : c.missionId,
        terminalState: c.terminal === true ? 'ENCERRADA' : null,
        truthEstablished: c.truth ?? true,
      },
      documentos: { ...b.operational.documentos, pendentes: [...(c.pendentes ?? [])] },
      ahri: { ...b.operational.ahri, ultimoContatoAt: c.ultimoContato ?? NOW },
    },
  };
}

function metricsOf(alir: ALIR): ALIRCompositionMetrics {
  return {
    clienteId: alir.clienteId,
    chatId: alir.chatId,
    schemaVersion: alir.schemaVersion,
    contentHash: '0',
    compositionMs: 0,
    groups: ['CORE', 'OPERATIONAL'],
    sourcesConsulted: [],
    fieldsReconstructed: [],
    fieldsUnavailable: [],
  };
}

class FakeComposer implements ALIRComposer {
  constructor(private readonly byChat: Map<string, ALIR>) {}
  compose(chatId: string): Promise<ALIRComposition> {
    const alir = this.byChat.get(chatId) ?? emptyALIR(chatId, chatId, NOW);
    return Promise.resolve({ alir, metrics: metricsOf(alir) });
  }
}
class FakeMemory implements MemoryStore {
  constructor(private readonly chats: readonly string[]) {}
  load(chatId: string): Promise<ClientMemory | null> {
    return Promise.resolve(emptyMemory(chatId));
  }
  save(): Promise<void> {
    return Promise.resolve();
  }
  all(): Promise<readonly ClientMemory[]> {
    return Promise.resolve(this.chats.map((c) => emptyMemory(c)));
  }
}
class FakeModalidade implements ModalidadeStore {
  public consultas: string[] = [];
  constructor(private readonly byCliente: Map<string, Modalidade>) {}
  load(clienteId: string): Promise<ModalidadeRecord | null> {
    this.consultas.push(clienteId);
    const m = this.byCliente.get(clienteId);
    return Promise.resolve(
      m !== undefined ? { clienteId, modalidade: m, decididaEm: NOW, decididaPor: 'admin' } : null,
    );
  }
  save(): Promise<void> {
    return Promise.resolve();
  }
}
class FakeVenda implements VendaStore {
  constructor(private readonly vendidos: readonly string[] = []) {}
  load(clienteId: string): Promise<VendaRecord | null> {
    return Promise.resolve(
      this.vendidos.includes(clienteId)
        ? { clienteId, chatId: 'c', comprador: 'Dr. X', vendidaEm: NOW, vendidaPor: 'admin' }
        : null,
    );
  }
  save(): Promise<void> {
    return Promise.resolve();
  }
}
class FakePedidos implements PedidosAdministrativosStore {
  constructor(private readonly byCliente: Record<string, Date> = {}) {}
  load(clienteId: string): Promise<PedidosAdministrativosRecord | null> {
    const em = this.byCliente[clienteId];
    return Promise.resolve(
      em !== undefined
        ? {
            clienteId,
            chatId: 'c',
            confirmadoEm: em,
            confirmadoPor: 'perito',
            bancos: ['BANCO X'],
            contratos: 1,
          }
        : null,
    );
  }
  save(): Promise<void> {
    return Promise.resolve();
  }
}

function listOf(
  clis: Cli[],
  modalidades: Record<string, Modalidade> = {},
  vendidos: string[] = [],
  pedidos: Record<string, Date> = {},
) {
  const byChat = new Map(clis.map((c) => [c.chatId, alirOf(c)]));
  const modalidade = new FakeModalidade(new Map(Object.entries(modalidades)));
  const list = new ClientesList({
    memory: new FakeMemory(clis.map((c) => c.chatId)),
    alir: new FakeComposer(byChat),
    modalidade,
    venda: new FakeVenda(vendidos),
    pedidos: new FakePedidos(pedidos),
  });
  return { list, modalidade };
}

describe('deriveClienteStatus · a tabela de filas congelada', () => {
  const ready = (alir: ALIR) => evaluateReadiness({ alir, caseType: 'GENERICO', now: NOW });

  const PEDIDO_RECENTE: PedidosAdministrativosRecord = {
    clienteId: 'cli-1',
    chatId: 'c',
    confirmadoEm: new Date('2026-07-15T12:00:00.000Z'),
    confirmadoPor: 'perito',
    bancos: ['BANCO X'],
    contratos: 1,
  };
  const PEDIDO_VENCIDO: PedidosAdministrativosRecord = {
    ...PEDIDO_RECENTE,
    confirmadoEm: new Date('2026-07-01T12:00:00.000Z'),
  };

  it('deriva cada status sem nada persistido', () => {
    const atendimento = alirOf({ chatId: 'c1', missionId: null });
    expect(deriveClienteStatus(atendimento, ready(atendimento), null, false, null, NOW)).toBe(
      'ATENDIMENTO',
    );

    const coletando = alirOf({ chatId: 'c2', pendentes: ['IDENTIDADE'] });
    expect(deriveClienteStatus(coletando, ready(coletando), null, false, null, NOW)).toBe(
      'COLETANDO_DOCUMENTOS',
    );

    const pronto = alirOf({ chatId: 'c3' });
    expect(deriveClienteStatus(pronto, ready(pronto), null, false, null, NOW)).toBe(
      'PRONTO_AGUARDANDO_MODALIDADE',
    );
    expect(deriveClienteStatus(pronto, ready(pronto), 'VENDA', false, null, NOW)).toBe(
      'PRONTO_AGUARDANDO_VENDA',
    );
    expect(deriveClienteStatus(pronto, ready(pronto), 'SOCIEDADE', false, null, NOW)).toBe(
      'PRONTO_AGUARDANDO_PERICIA',
    );

    const encerrado = alirOf({ chatId: 'c4', terminal: true });
    expect(deriveClienteStatus(encerrado, ready(encerrado), 'VENDA', false, null, NOW)).toBe(
      'ENCERRADO',
    );

    // R3 — venda registrada precede o terminal genérico.
    expect(deriveClienteStatus(encerrado, ready(encerrado), 'VENDA', true, null, NOW)).toBe(
      'VENDIDO',
    );
  });

  it('B-R3 — o FATO + relógio derivam as filas da Jornada B (Lei 8)', () => {
    const pronto = alirOf({ chatId: 'c3' });
    // Confirmado há 3 dias → dentro do prazo.
    expect(
      deriveClienteStatus(pronto, ready(pronto), 'SOCIEDADE', false, PEDIDO_RECENTE, NOW),
    ).toBe('AGUARDANDO_10_DIAS');
    // Confirmado há 17 dias → prazo vencido, aguardando sócio.
    expect(
      deriveClienteStatus(pronto, ready(pronto), 'SOCIEDADE', false, PEDIDO_VENCIDO, NOW),
    ).toBe('AGUARDANDO_SOCIO');
    // Prazo calculado do fato: 10 dias exatos.
    expect(prazoDosPedidos(PEDIDO_RECENTE.confirmadoEm).toISOString()).toBe(
      '2026-07-25T12:00:00.000Z',
    );

    // Atribuição ao sócio (no ALIR) precede as filas de prazo → EM_PROCESSO.
    const emProcesso = alirOf({ chatId: 'c5' });
    const comAtribuicao = {
      ...emProcesso,
      operational: {
        ...emProcesso.operational,
        operacao: {
          ...emProcesso.operational.operacao,
          atribuicao: { advogadoId: 'adv-1', assignedBy: 'admin', assignedAt: NOW },
        },
      },
    };
    expect(
      deriveClienteStatus(
        comAtribuicao,
        ready(comAtribuicao),
        'SOCIEDADE',
        false,
        PEDIDO_VENCIDO,
        NOW,
      ),
    ).toBe('EM_PROCESSO');
    // Encerrado prevalece sobre EM_PROCESSO (terminal).
    const encerradoComAtribuicao = {
      ...comAtribuicao,
      operational: {
        ...comAtribuicao.operational,
        missao: { ...comAtribuicao.operational.missao, terminalState: 'ENCERRADA' as const },
      },
    };
    expect(
      deriveClienteStatus(
        encerradoComAtribuicao,
        ready(encerradoComAtribuicao),
        'SOCIEDADE',
        false,
        PEDIDO_VENCIDO,
        NOW,
      ),
    ).toBe('ENCERRADO');
  });
});

describe('ClientesList · lista única', () => {
  it('lista todos os clientes com status derivado e ordena por último contato', async () => {
    const antigo = new Date('2026-07-10T12:00:00.000Z');
    const { list } = listOf(
      [
        { chatId: 'c1', clienteId: 'cli-1', nome: 'Maria', ultimoContato: antigo },
        { chatId: 'c2', clienteId: 'cli-2', nome: 'João', pendentes: ['IDENTIDADE'] },
      ],
      { 'cli-1': 'VENDA' },
    );
    const clientes = await list.list(NOW);
    expect(clientes).toHaveLength(2);
    expect(clientes[0]?.quem).toBe('João'); // mais recente primeiro
    expect(clientes[0]?.status).toBe('COLETANDO_DOCUMENTOS');
    expect(clientes[0]?.faltando).toContain('documento de identidade');
    expect(clientes[1]?.quem).toBe('Maria');
    expect(clientes[1]?.status).toBe('PRONTO_AGUARDANDO_VENDA');
    expect(clientes[1]?.modalidade).toBe('VENDA');
  });

  it('prontosParaVenda devolve apenas a fila do Modelo A', async () => {
    const { list } = listOf(
      [
        { chatId: 'c1', clienteId: 'cli-1' },
        { chatId: 'c2', clienteId: 'cli-2' },
        { chatId: 'c3', clienteId: 'cli-3', terminal: true },
      ],
      { 'cli-1': 'VENDA', 'cli-2': 'SOCIEDADE', 'cli-3': 'VENDA' },
    );
    const fila = await list.prontosParaVenda(NOW);
    expect(fila).toHaveLength(1);
    expect(fila[0]?.clienteId).toBe('cli-1');
  });

  it('R3 — cliente com venda registrada aparece como VENDIDO (e sai da fila)', async () => {
    const { list } = listOf(
      [{ chatId: 'c1', clienteId: 'cli-1', terminal: true }],
      { 'cli-1': 'VENDA' },
      ['cli-1'],
    );
    const clientes = await list.list(NOW);
    expect(clientes[0]?.status).toBe('VENDIDO');
    expect(await list.prontosParaVenda(NOW)).toHaveLength(0);
  });

  it('não consulta modalidade para contato NÃO reconhecido (clienteId provisório = chatId)', async () => {
    const { list, modalidade } = listOf([{ chatId: 'novo@c.us', missionId: null }]);
    const clientes = await list.list(NOW);
    expect(clientes[0]?.status).toBe('ATENDIMENTO');
    expect(clientes[0]?.modalidade).toBeNull();
    expect(modalidade.consultas).toEqual([]); // chat é canal; modalidade é do cliente
  });
});
