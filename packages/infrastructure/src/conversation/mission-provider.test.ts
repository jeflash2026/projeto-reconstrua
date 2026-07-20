// ─────────────────────────────────────────────────────────────────────────────
// MISSAO PROVIDER (GO-LIVE 15A) — teste de INTEGRAÇÃO: o estado da conversa é
// derivado da MISSÃO ATIVA (snapshot do Mission Runtime) como fonte PRIMÁRIA,
// com o status do cliente como um dos sinais. Atravessa provider →
// ConversationContextView → política e prova a transição:
//   LEAD → EM_ANALISE → CLIENTE → POS_ATENDIMENTO
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type {
  ClienteResumo, ClienteStatus, ClientesList, ConversationContextView,
  MissionSnapshot, MissionSnapshotPort, SessionRuntime, ConversationMemoryRuntime,
} from '@reconstrua/application';
import { ConversationContextRuntime, emptySnapshot, politicaDaMissao } from '@reconstrua/application';
import { criarMissaoProvider } from './mission-provider.js';

const CHAT = '5511999@c';
const NOW = new Date('2026-07-19T12:00:00.000Z');
class TestClock implements Clock {
  now(): Date { return NOW; }
}

function snap(over: Partial<MissionSnapshot>): MissionSnapshot {
  return { ...emptySnapshot(CHAT), ...over };
}
function snapshots(s: MissionSnapshot | null): MissionSnapshotPort {
  return { load: () => Promise.resolve(s) };
}
function resumo(status: ClienteStatus, missionId: string | null): ClienteResumo {
  return {
    clienteId: 'CLI-1', chatId: CHAT, missionId, quem: 'João', status, modalidade: null,
    pronto: false, faltando: [], saude: null, ultimoContatoAt: NOW, pedidosConfirmadosEm: null,
  };
}
function clientes(status: ClienteStatus, missionId: string | null): ClientesList {
  return { list: () => Promise.resolve([resumo(status, missionId)]) } as unknown as ClientesList;
}

const sessions = { getOrOpen: () => Promise.resolve({ chatId: CHAT, turns: 0, lastInboundAt: null, lastOutboundAt: null }) } as unknown as SessionRuntime;
const memory = { recent: () => Promise.resolve([]), recentOutboundTexts: () => Promise.resolve([]) } as unknown as ConversationMemoryRuntime;

async function estado(snapshot: MissionSnapshot | null, status: ClienteStatus, missionId: string | null): Promise<ConversationContextView['missaoDaConversa']> {
  const provider = criarMissaoProvider(snapshots(snapshot), clientes(status, missionId), new TestClock());
  const view = await new ConversationContextRuntime(sessions, memory, {}, undefined, provider).build(CHAT, null, NOW);
  return view.missaoDaConversa;
}

describe('15A · a MISSÃO ATIVA (Mission Runtime) transiciona o estado da conversa', () => {
  it('LEAD: sem missão ativa (snapshot sem caseExists, sem missão no cliente)', async () => {
    expect(await estado(snap({ caseExists: false }), 'ATENDIMENTO', null)).toBe('LEAD');
  });

  it('EM_ANALISE: missão ATIVA no snapshot, ainda não vendida', async () => {
    expect(await estado(snap({ caseExists: true, stateCode: 'ABERTA' }), 'COLETANDO_DOCUMENTOS', 'M-1')).toBe('EM_ANALISE');
  });

  it('CLIENTE: missão ativa + status do cliente VENDIDO', async () => {
    expect(await estado(snap({ caseExists: true }), 'VENDIDO', 'M-1')).toBe('CLIENTE');
  });

  it('POS_ATENDIMENTO: missão ativa com estado terminal ENCERRADA (do Runtime)', async () => {
    expect(await estado(snap({ caseExists: true, stateCode: 'ENCERRADA' }), 'EM_PROCESSO', 'M-1')).toBe('POS_ATENDIMENTO');
  });

  it('PRIMAZIA do Mission Runtime: snapshot com missão ativa vence, mesmo sem cliente na lista', async () => {
    const provider = criarMissaoProvider(snapshots(snap({ caseExists: true })), { list: () => Promise.resolve([]) } as unknown as ClientesList, new TestClock());
    expect(await provider(CHAT)).toBe('EM_ANALISE');
  });

  it('a TRANSIÇÃO completa muda a POLÍTICA e o OBJETIVO da missão', async () => {
    const jornada: Array<[MissionSnapshot | null, ClienteStatus, string | null]> = [
      [snap({ caseExists: false }), 'ATENDIMENTO', null],
      [snap({ caseExists: true, stateCode: 'ABERTA' }), 'COLETANDO_DOCUMENTOS', 'M-1'],
      [snap({ caseExists: true }), 'VENDIDO', 'M-1'],
      [snap({ caseExists: true, stateCode: 'ENCERRADA' }), 'EM_PROCESSO', 'M-1'],
    ];
    const esperado = [
      { missao: 'LEAD', objetivo: 'Converter Lead', substitui: true },
      { missao: 'EM_ANALISE', objetivo: 'Completar Documentação', substitui: true },
      { missao: 'CLIENTE', objetivo: 'Acompanhar Processo', substitui: false },
      { missao: 'POS_ATENDIMENTO', objetivo: 'Suporte', substitui: false },
    ];
    for (let i = 0; i < jornada.length; i += 1) {
      const [s, status, mid] = jornada[i]!;
      const provider = criarMissaoProvider(snapshots(s), clientes(status, mid), new TestClock());
      const view = await new ConversationContextRuntime(sessions, memory, {}, undefined, provider).build(CHAT, null, NOW);
      const p = politicaDaMissao(view);
      expect(p.missao).toBe(esperado[i]!.missao);
      expect(p.objetivo).toBe(esperado[i]!.objetivo);
      expect(p.substituiCuriosidade).toBe(esperado[i]!.substitui);
    }
  });

  it('novo contato (sem snapshot e sem cliente) ⇒ null ⇒ LEAD', async () => {
    const provider = criarMissaoProvider(snapshots(null), { list: () => Promise.resolve([]) } as unknown as ClientesList, new TestClock());
    expect(await provider('desconhecido@c')).toBeNull();
  });
});
