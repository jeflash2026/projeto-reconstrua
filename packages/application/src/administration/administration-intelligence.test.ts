// ─────────────────────────────────────────────────────────────────────────────
// GO-LIVE-03 (itens 4/5) — testes do cérebro administrativo: cobertura ampliada
// do roteador, respostas com FONTES REAIS (lista única + casos por advogado),
// honestidade sem fonte (não disponível — jamais inventado) e o fim do "unknown"
// no Founder Console (resposta útil, nunca slug interno).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { MemoryStore } from '../living-memory/ports.js';
import type { AdminMetricsStore } from './ports.js';
import { emptyMetrics } from './admin-metrics.js';
import { AdministrationIntelligenceRuntime, type AdminIntelligenceSources } from './administration-intelligence-runtime.js';
import { FounderConsoleRuntime } from './founder-console-runtime.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

const metricsStore: AdminMetricsStore = {
  load: () => Promise.resolve({ ...emptyMetrics(NOW), clientCount: 3, documentCount: 7 }),
  save: () => Promise.resolve(),
};
const memoryStore: MemoryStore = { load: () => Promise.resolve(null), save: () => Promise.resolve(), all: () => Promise.resolve([]) };

const SOURCES: AdminIntelligenceSources = {
  clientes: () =>
    Promise.resolve([
      { status: 'AGUARDANDO_SOCIO', quem: 'Maria' },
      { status: 'PRONTO_AGUARDANDO_PERICIA', quem: 'João' },
      { status: 'PRONTO_AGUARDANDO_PERICIA', quem: 'Ana' },
      { status: 'EM_PROCESSO', quem: 'Rui' },
    ]),
  porAdvogado: () =>
    Promise.resolve([
      { nome: 'Ana Lima', casos: 5, ultimaAtividadeAt: new Date('2026-07-17T10:00:00.000Z') },
      { nome: 'Caio Melo', casos: 2, ultimaAtividadeAt: new Date('2026-06-01T10:00:00.000Z') },
    ]),
};

function runtime(sources?: AdminIntelligenceSources) {
  return new AdministrationIntelligenceRuntime(metricsStore, memoryStore, sources ?? {});
}

describe('AdministrationIntelligence · roteador ampliado (GO-LIVE-03)', () => {
  it('perícia, sócio, documentos totais e advogados agora roteiam', () => {
    const r = runtime();
    expect(r.route('quantos clientes estão na perícia?')).toBe('clients_awaiting_expertise');
    expect(r.route('como está a fila do sócio?')).toBe('clients_awaiting_lawyer');
    expect(r.route('quantos documentos temos?')).toBe('document_count');
    expect(r.route('quantos advogados ativos?')).toBe('lawyer_count');
    expect(r.route('qual advogado tem mais processos?')).toBe('lawyer_most_processes');
  });
});

describe('AdministrationIntelligence · fontes REAIS ligadas', () => {
  it('fila da perícia e do sócio vêm da lista única (status derivado)', async () => {
    const r = runtime(SOURCES);
    const pericia = await r.answer('clients_awaiting_expertise', NOW);
    expect(pericia.available).toBe(true);
    expect(pericia.value).toBe(2);
    expect(pericia.items).toEqual(['João', 'Ana']);
    const socio = await r.answer('clients_awaiting_lawyer', NOW);
    expect(socio.value).toBe(1);
    expect(socio.items).toEqual(['Maria']);
  });

  it('advogados: contagem, mais processos e mais tempo sem movimentação', async () => {
    const r = runtime(SOURCES);
    expect((await r.answer('lawyer_count', NOW)).value).toBe(2);
    const top = await r.answer('lawyer_most_processes', NOW);
    expect(top.items).toEqual(['Ana Lima']);
    const stalest = await r.answer('lawyer_stalest', NOW);
    expect(stalest.items).toEqual(['Caio Melo']);
  });

  it('documentos totais vêm do read model de métricas', async () => {
    const doc = await runtime().answer('document_count', NOW);
    expect(doc.available).toBe(true);
    expect(doc.value).toBe(7);
  });

  it('SEM fonte ligada → honestamente NÃO DISPONÍVEL (jamais inventado)', async () => {
    const r = runtime();
    for (const kind of ['clients_awaiting_lawyer', 'clients_awaiting_expertise', 'lawyer_count', 'lawyer_most_processes'] as const) {
      const a = await r.answer(kind, NOW);
      expect(a.available).toBe(false);
      expect(a.fact).toContain('não disponível');
    }
  });

  it('financeiro/campanha/ROI: fonte não existe no domínio → declarado, nunca inventado', async () => {
    const a = await runtime(SOURCES).answer('financial_under_administration', NOW);
    expect(a.available).toBe(false);
  });
});

describe('FounderConsole · o fim do "unknown" (item 5)', () => {
  it('pergunta fora do mapa → resposta ÚTIL em português; nunca o slug "unknown"', async () => {
    const narration = { narrate: () => Promise.resolve('narrado') };
    const console_ = new FounderConsoleRuntime(runtime(SOURCES), narration, metricsStore, { founderName: 'Jessé' });
    const res = await console_.ask('qual é o sentido da vida?', NOW);
    expect(res.available).toBe(false);
    expect(res.answer).not.toContain('unknown');
    expect(res.answer).toContain('Posso responder sobre');
    expect(res.decidesNothing).toBe(true);
  });
});
