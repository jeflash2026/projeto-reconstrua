// ─────────────────────────────────────────────────────────────────────────────
// MISSAO PROVIDER (GO-LIVE 15A · Decreto "Jornada Documental Inicial") — teste
// de INTEGRAÇÃO: o estado da conversa é derivado da MISSÃO ATIVA (snapshot do
// Mission Runtime) como fonte PRIMÁRIA, com o status do cliente e a
// CONTABILIDADE da Jornada 1 como sinais. Prova a jornada completa:
//   LEAD → ONBOARDING_DOCUMENTAL → ANALISE_ADMINISTRATIVA → CLIENTE → POS
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type {
  ClienteResumo, ClienteStatus, ClientesList, ConversationContextView,
  MissionSnapshot, MissionSnapshotPort, SessionRuntime, ConversationMemoryRuntime,
} from '@reconstrua/application';
import { ConversationContextRuntime, emptySnapshot, politicaDaMissao } from '@reconstrua/application';
import { criarMissaoProvider, type OnboardingCompletude } from './mission-provider.js';

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
function jornada1(completa: boolean): OnboardingCompletude {
  return { estaCompleto: () => Promise.resolve(completa) };
}

const sessions = { getOrOpen: () => Promise.resolve({ chatId: CHAT, turns: 0, lastInboundAt: null, lastOutboundAt: null }) } as unknown as SessionRuntime;
const memory = { recent: () => Promise.resolve([]), recentOutboundTexts: () => Promise.resolve([]) } as unknown as ConversationMemoryRuntime;

async function estado(
  snapshot: MissionSnapshot | null,
  status: ClienteStatus,
  missionId: string | null,
  onboarding: OnboardingCompletude | null = null,
): Promise<ConversationContextView['missaoDaConversa']> {
  const provider = criarMissaoProvider(snapshots(snapshot), clientes(status, missionId), new TestClock(), onboarding);
  const view = await new ConversationContextRuntime(sessions, memory, {}, undefined, provider).build(CHAT, null, NOW);
  return view.missaoDaConversa;
}

describe('Decreto · a MISSÃO ATIVA + Jornada 1 transicionam o estado da conversa', () => {
  it('LEAD: sem missão ativa (snapshot sem caseExists, sem missão no cliente)', async () => {
    expect(await estado(snap({ caseExists: false }), 'ATENDIMENTO', null)).toBe('LEAD');
  });

  it('ONBOARDING_DOCUMENTAL: missão ativa + documentação inicial INCOMPLETA', async () => {
    expect(await estado(snap({ caseExists: true, stateCode: 'ABERTA' }), 'COLETANDO_DOCUMENTOS', 'M-1', jornada1(false))).toBe('ONBOARDING_DOCUMENTAL');
  });

  it('ANALISE_ADMINISTRATIVA: os 3 obrigatórios 100% ⇒ mudança AUTOMÁTICA', async () => {
    expect(await estado(snap({ caseExists: true, stateCode: 'ABERTA' }), 'COLETANDO_DOCUMENTOS', 'M-1', jornada1(true))).toBe('ANALISE_ADMINISTRATIVA');
  });

  it('contabilidade AUSENTE ou com falha ⇒ fail-closed: continua ONBOARDING', async () => {
    expect(await estado(snap({ caseExists: true }), 'COLETANDO_DOCUMENTOS', 'M-1', null)).toBe('ONBOARDING_DOCUMENTAL');
    const quebrada: OnboardingCompletude = { estaCompleto: () => Promise.reject(new Error('down')) };
    expect(await estado(snap({ caseExists: true }), 'COLETANDO_DOCUMENTOS', 'M-1', quebrada)).toBe('ONBOARDING_DOCUMENTAL');
  });

  it('CLIENTE: missão ativa + status do cliente VENDIDO', async () => {
    expect(await estado(snap({ caseExists: true }), 'VENDIDO', 'M-1', jornada1(true))).toBe('CLIENTE');
  });

  it('POS_ATENDIMENTO: missão ativa com estado terminal ENCERRADA (do Runtime)', async () => {
    expect(await estado(snap({ caseExists: true, stateCode: 'ENCERRADA' }), 'EM_PROCESSO', 'M-1', jornada1(true))).toBe('POS_ATENDIMENTO');
  });

  it('PRIMAZIA do Mission Runtime: snapshot com missão ativa vence, mesmo sem cliente na lista', async () => {
    const provider = criarMissaoProvider(snapshots(snap({ caseExists: true })), { list: () => Promise.resolve([]) } as unknown as ClientesList, new TestClock());
    expect(await provider(CHAT)).toBe('ONBOARDING_DOCUMENTAL');
  });

  it('a JORNADA COMPLETA do decreto muda a POLÍTICA e o OBJETIVO da missão', async () => {
    const jornada: Array<[MissionSnapshot | null, ClienteStatus, string | null, OnboardingCompletude | null]> = [
      [snap({ caseExists: false }), 'ATENDIMENTO', null, null],
      [snap({ caseExists: true, stateCode: 'ABERTA' }), 'COLETANDO_DOCUMENTOS', 'M-1', jornada1(false)],
      [snap({ caseExists: true, stateCode: 'ABERTA' }), 'COLETANDO_DOCUMENTOS', 'M-1', jornada1(true)],
      [snap({ caseExists: true }), 'VENDIDO', 'M-1', jornada1(true)],
      [snap({ caseExists: true, stateCode: 'ENCERRADA' }), 'EM_PROCESSO', 'M-1', jornada1(true)],
    ];
    const esperado = [
      { missao: 'LEAD', objetivo: 'Converter Lead', substitui: true },
      { missao: 'ONBOARDING_DOCUMENTAL', objetivo: 'Completar a Documentação Inicial', substitui: true },
      { missao: 'ANALISE_ADMINISTRATIVA', objetivo: 'Acompanhar a Análise Administrativa', substitui: false },
      { missao: 'CLIENTE', objetivo: 'Acompanhar Processo', substitui: false },
      { missao: 'POS_ATENDIMENTO', objetivo: 'Suporte', substitui: false },
    ];
    for (let i = 0; i < jornada.length; i += 1) {
      const [s, status, mid, ob] = jornada[i]!;
      const provider = criarMissaoProvider(snapshots(s), clientes(status, mid), new TestClock(), ob);
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
