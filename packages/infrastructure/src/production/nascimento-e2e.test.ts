// ─────────────────────────────────────────────────────────────────────────────
// NASCIMENTO DO PORTAL (PC-R3) — integração com os adapters Json REAIS: cliente
// pronto com evidência → varredura → FATO persistido (round-trip com Date) →
// a visão de acompanhamento passa a ancorar o relógio no fato (estimativaAte).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  AcompanhamentoView,
  ClientesList,
  NascimentoPortalRuntime,
  emptyMemory,
  validarTokenCliente,
  type ComunicadorNascimento,
} from '@reconstrua/application';
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
  JsonVendaStore,
  JsonPedidosAdministrativosStore,
  JsonLiberacaoPortalStore,
} from './document-stores.js';
import { JsonDecisionStateStore } from '../executive-brain/decision-state-read-model.js';
import { assembleALIR } from '../alir/build-alir.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');
const SECRET = 'segredo-portal';

describe('Nascimento e2e (Json stores reais)', () => {
  it('varredura → fato → mensagem com link válido → visão ancora estimativaAte', async () => {
    const json = new InMemoryJsonStore();
    const identityMap = new JsonIdentityMap(json);
    const memoryStore = new JsonMemoryStore(json);
    const decisionState = new JsonDecisionStateStore(json);
    const juridicalStore = new JsonJuridicalWorkStore(json);
    const assignmentStore = new JsonAssignmentStore(json);
    const staffStore = new JsonStaffStore(json);
    const liberacaoStore = new JsonLiberacaoPortalStore(json);
    const alir = assembleALIR({
      identityMap,
      memoryStore,
      decisionState,
      progressStore: new JsonProgressStore(json),
      schedulerStore: new JsonSchedulerStore(json),
      handoffStore: new JsonHandoffStore(json),
      assignmentStore,
      staffStore,
      juridicalStore,
    });
    const clientes = new ClientesList({
      memory: memoryStore,
      alir: alir.builder,
      modalidade: new JsonModalidadeStore(json),
      venda: new JsonVendaStore(json),
      pedidos: new JsonPedidosAdministrativosStore(json),
    });

    // Cliente RECONHECIDO, PRONTO (verdade + sem pendências) com os 3 documentos
    // REAIS do decreto "Jornada Documental Inicial" (HISCON + RG/CNH + endereço).
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
      documentsSent: [
        {
          ref: 'd1',
          label: 'Documento de identidade',
          source: { kind: 'domain_event', ref: 'e1', at: NOW },
        },
        {
          ref: 'd2',
          label: 'Comprovante de residência',
          source: { kind: 'domain_event', ref: 'e2', at: NOW },
        },
        { ref: 'd3', label: 'HISCON', source: { kind: 'domain_event', ref: 'e3', at: NOW } },
      ],
      lastContactAt: NOW,
    });
    await decisionState.save({ missionId: 'm1', truthEstablished: true, updatedAt: NOW });

    const mensagens: string[] = [];
    const comunicador: ComunicadorNascimento = {
      comunicar: (_chat, _cli, texto) => {
        mensagens.push(texto);
        return Promise.resolve(true);
      },
    };
    const nascimento = new NascimentoPortalRuntime({
      clientes,
      memory: memoryStore,
      liberacao: liberacaoStore,
      comunicador,
      config: {
        estimativaDias: 12,
        validadeLinkDias: 90,
        publicUrl: 'https://www.projetoreconstrua.com.br',
        tokenSecret: SECRET,
      },
    });

    // O momento acontece:
    const r = await nascimento.verificar(NOW);
    expect(r.nascidos).toEqual(['cli-1']);

    // Fato persistido de verdade (Date revivida no round-trip):
    const fato = await liberacaoStore.load('cli-1');
    expect(fato?.comunicadoEm).toBeInstanceOf(Date);
    expect(fato?.estimativaDiasInformada).toBe(12);

    // O link da mensagem valida para o cliente certo:
    const token = /\?t=([^\s]+)/.exec(mensagens[0] ?? '')?.[1] ?? '';
    expect(validarTokenCliente(token, NOW, SECRET)).toBe('cli-1');

    // A visão do Portal agora ANCORA o relógio no fato (nada muda na relação):
    const view = new AcompanhamentoView({
      clientes,
      memory: memoryStore,
      juridical: juridicalStore,
      assignments: assignmentStore,
      staff: staffStore,
      liberacao: (id) => liberacaoStore.load(id),
      config: { estimativaDias: 12, whatsapp: '554137989737' },
    });
    const a = await view.acompanhamento('cli-1', NOW);
    expect(a?.estimativaAte?.toISOString().slice(0, 10)).toBe('2026-07-30'); // fato + 12 dias

    // Idempotência ponta a ponta:
    await nascimento.verificar(new Date(NOW.getTime() + 60_000));
    expect(mensagens).toHaveLength(1);
  });
});
