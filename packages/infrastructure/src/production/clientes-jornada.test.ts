// ─────────────────────────────────────────────────────────────────────────────
// CLIENTES · JORNADA (R2) — integração: ClientesList sobre os adapters Json REAIS
// (mesmo wiring do assembleProduction). Prova a fila derivada + o marcador
// modalidade chaveado por clienteId (com revive de Date).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ClientesList, emptyMemory } from '@reconstrua/application';
import { InMemoryJsonStore } from './json-store.js';
import {
  JsonMemoryStore,
  JsonSchedulerStore,
  JsonHandoffStore,
  JsonProgressStore,
  JsonStaffStore,
  JsonAssignmentStore,
  JsonJuridicalWorkStore,
  JsonIdentityMap,
  JsonModalidadeStore,
  JsonPedidosAdministrativosStore,
  JsonVendaStore,
} from './document-stores.js';
import { JsonDecisionStateStore } from '../executive-brain/decision-state-read-model.js';
import { assembleALIR } from '../alir/build-alir.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

async function wire() {
  const json = new InMemoryJsonStore();
  const identityMap = new JsonIdentityMap(json);
  const memoryStore = new JsonMemoryStore(json);
  const decisionState = new JsonDecisionStateStore(json);
  const modalidadeStore = new JsonModalidadeStore(json);
  const vendaStore = new JsonVendaStore(json);
  const pedidosStore = new JsonPedidosAdministrativosStore(json);
  const alir = assembleALIR({
    identityMap,
    memoryStore,
    decisionState,
    progressStore: new JsonProgressStore(json),
    schedulerStore: new JsonSchedulerStore(json),
    handoffStore: new JsonHandoffStore(json),
    assignmentStore: new JsonAssignmentStore(json),
    staffStore: new JsonStaffStore(json),
    juridicalStore: new JsonJuridicalWorkStore(json),
  });
  const clientes = new ClientesList({
    memory: memoryStore,
    alir: alir.builder,
    modalidade: modalidadeStore,
    venda: vendaStore,
    pedidos: pedidosStore,
  });

  // Cliente reconhecido, caso pronto (verdade sintetizada, sem docs pendentes).
  await identityMap.save({
    chatId: 'c1',
    personId: 'p1',
    clienteId: 'cli-1',
    missionId: 'm1',
    caseId: null,
    processId: null,
    latestTruthId: null,
    latestStateId: null,
    latestStageId: null,
    lastDocumentId: null,
    lastEventId: null,
  });
  await memoryStore.save({
    ...emptyMemory('c1'),
    attributes: [
      {
        key: 'nome',
        value: 'Maria',
        source: { kind: 'conversation', ref: 'x', at: NOW },
        confidence: 0.9,
      },
    ],
    lastContactAt: NOW,
  });
  await decisionState.save({ missionId: 'm1', truthEstablished: true, updatedAt: NOW });

  // Contato novo, sem caso.
  await memoryStore.save(emptyMemory('novo@c.us'));

  return { clientes, modalidadeStore, vendaStore, pedidosStore };
}

describe('ClientesList · wiring de produção (Json stores)', () => {
  it('deriva as filas em leitura e reage ao marcador de modalidade', async () => {
    const { clientes, modalidadeStore } = await wire();

    // Sem marcador: pronto aguardando a decisão do Admin.
    let lista = await clientes.list(NOW);
    const maria = lista.find((c) => c.clienteId === 'cli-1');
    expect(maria?.status).toBe('PRONTO_AGUARDANDO_MODALIDADE');
    expect(lista.find((c) => c.chatId === 'novo@c.us')?.status).toBe('ATENDIMENTO');
    expect(await clientes.prontosParaVenda(NOW)).toHaveLength(0);

    // Admin decide VENDA (marcador por clienteId) → entra na fila do Modelo A.
    await modalidadeStore.save({
      clienteId: 'cli-1',
      modalidade: 'VENDA',
      decididaEm: NOW,
      decididaPor: 'admin',
    });
    lista = await clientes.list(NOW);
    expect(lista.find((c) => c.clienteId === 'cli-1')?.status).toBe('PRONTO_AGUARDANDO_VENDA');
    const fila = await clientes.prontosParaVenda(NOW);
    expect(fila).toHaveLength(1);
    expect(fila[0]?.quem).toBe('Maria');
  });

  it('B-R3 — fato confirmado + relógio derivam as filas da Jornada B (stores reais)', async () => {
    const { clientes, modalidadeStore, pedidosStore } = await wire();
    await modalidadeStore.save({
      clienteId: 'cli-1',
      modalidade: 'SOCIEDADE',
      decididaEm: NOW,
      decididaPor: 'admin',
    });

    // Antes do fato: fila da perícia.
    let lista = await clientes.list(NOW);
    expect(lista.find((c) => c.clienteId === 'cli-1')?.status).toBe('PRONTO_AGUARDANDO_PERICIA');

    // Fato confirmado (round-trip com Date revivida) → prazo correndo.
    await pedidosStore.save({
      clienteId: 'cli-1',
      chatId: 'c1',
      confirmadoEm: NOW,
      confirmadoPor: 'perito',
      bancos: ['BANCO BMG S/A'],
      contratos: 2,
    });
    const fato = await pedidosStore.load('cli-1');
    expect(fato?.confirmadoEm).toBeInstanceOf(Date);
    expect(fato?.bancos).toEqual(['BANCO BMG S/A']);

    lista = await clientes.list(NOW);
    expect(lista.find((c) => c.clienteId === 'cli-1')?.status).toBe('AGUARDANDO_10_DIAS');
    expect(lista.find((c) => c.clienteId === 'cli-1')?.pedidosConfirmadosEm?.toISOString()).toBe(
      NOW.toISOString(),
    );

    // 11 dias depois: prazo vencido → aguardando sócio (só o relógio mudou; Lei 8).
    const DEPOIS = new Date(NOW.getTime() + 11 * 24 * 60 * 60 * 1000);
    lista = await clientes.list(DEPOIS);
    expect(lista.find((c) => c.clienteId === 'cli-1')?.status).toBe('AGUARDANDO_SOCIO');
  });

  it('R3 — venda registrada → status VENDIDO e fila de venda esvazia', async () => {
    const { clientes, modalidadeStore, vendaStore } = await wire();
    await modalidadeStore.save({
      clienteId: 'cli-1',
      modalidade: 'VENDA',
      decididaEm: NOW,
      decididaPor: 'admin',
    });
    await vendaStore.save({
      clienteId: 'cli-1',
      chatId: 'c1',
      comprador: 'Escritório X',
      vendidaEm: NOW,
      vendidaPor: 'admin',
    });

    const lista = await clientes.list(NOW);
    expect(lista.find((c) => c.clienteId === 'cli-1')?.status).toBe('VENDIDO');
    expect(await clientes.prontosParaVenda(NOW)).toHaveLength(0);

    // Round-trip com Date revivida.
    const venda = await vendaStore.load('cli-1');
    expect(venda?.comprador).toBe('Escritório X');
    expect(venda?.vendidaEm).toBeInstanceOf(Date);
  });

  it('marcador persiste com Date revivida (round-trip Json)', async () => {
    const json = new InMemoryJsonStore();
    const store = new JsonModalidadeStore(json);
    await store.save({
      clienteId: 'cli-9',
      modalidade: 'SOCIEDADE',
      decididaEm: NOW,
      decididaPor: 'admin',
    });
    const loaded = await store.load('cli-9');
    expect(loaded?.modalidade).toBe('SOCIEDADE');
    expect(loaded?.decididaEm).toBeInstanceOf(Date);
    expect(loaded?.decididaEm.toISOString()).toBe(NOW.toISOString());
    expect(await store.load('desconhecido')).toBeNull();
  });
});
