// ─────────────────────────────────────────────────────────────────────────────
// Testes de computeOperationalMetrics (B4.4) — agregação PURA dos read models.
// Prova cada um dos 10 indicadores + os casos de ausência (null, jamais inventado).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { computeOperationalMetrics, type OperationalMetricsInputs } from './operational-metrics.js';

const DAY = 24 * 60 * 60_000;
const base = (over: Partial<OperationalMetricsInputs> = {}): OperationalMetricsInputs => ({
  missions: [],
  terminals: [],
  reopenedCount: 0,
  scheduler: { pending: 0, fired: 0 },
  interactions: [],
  progresses: [],
  casesByAdvogado: {},
  ...over,
});

describe('computeOperationalMetrics (B4.4)', () => {
  it('ativos = total − encerrados; encerrados e reabertos vêm dos read models', () => {
    const m = computeOperationalMetrics(
      base({
        missions: [
          { missionId: 'M1', createdAt: new Date('2026-07-01T00:00:00Z') },
          { missionId: 'M2', createdAt: new Date('2026-07-01T00:00:00Z') },
          { missionId: 'M3', createdAt: new Date('2026-07-01T00:00:00Z') },
        ],
        terminals: [
          { missionId: 'M1', terminalState: 'ENCERRADA', updatedAt: new Date('2026-07-05T00:00:00Z') },
          { missionId: 'M2', terminalState: null, updatedAt: new Date('2026-07-03T00:00:00Z') },
        ],
        reopenedCount: 4,
      }),
    );
    expect(m.totalProcessos).toBe(3);
    expect(m.processosEncerrados).toBe(1);
    expect(m.processosAtivos).toBe(2);
    expect(m.processosReabertos).toBe(4);
  });

  it('follow-ups pendentes/enviados vêm da contagem do scheduler', () => {
    const m = computeOperationalMetrics(base({ scheduler: { pending: 7, fired: 12 } }));
    expect(m.followUpsPendentes).toBe(7);
    expect(m.followUpsEnviados).toBe(12);
  });

  it('tempo médio entre interações = (última−primeira)/(msgs−1), média entre clientes', () => {
    const m = computeOperationalMetrics(
      base({
        interactions: [
          // 4 dias / (5-1) = 1 dia por interação
          { messageCount: 5, firstContactAt: new Date('2026-07-01T00:00:00Z'), lastContactAt: new Date('2026-07-05T00:00:00Z'), documentsPending: 0 },
          // 2 dias / (3-1) = 1 dia
          { messageCount: 3, firstContactAt: new Date('2026-07-01T00:00:00Z'), lastContactAt: new Date('2026-07-03T00:00:00Z'), documentsPending: 0 },
          // uma só mensagem: sem intervalo (ignorada)
          { messageCount: 1, firstContactAt: new Date('2026-07-01T00:00:00Z'), lastContactAt: new Date('2026-07-01T00:00:00Z'), documentsPending: 0 },
        ],
      }),
    );
    expect(m.tempoMedioEntreInteracoesMs).toBe(DAY);
  });

  it('tempo médio até encerramento = média(encerramento − nascimento) dos encerrados', () => {
    const m = computeOperationalMetrics(
      base({
        missions: [
          { missionId: 'M1', createdAt: new Date('2026-07-01T00:00:00Z') },
          { missionId: 'M2', createdAt: new Date('2026-07-01T00:00:00Z') },
        ],
        terminals: [
          { missionId: 'M1', terminalState: 'ENCERRADA', updatedAt: new Date('2026-07-03T00:00:00Z') }, // 2 dias
          { missionId: 'M2', terminalState: 'ENCERRADA', updatedAt: new Date('2026-07-05T00:00:00Z') }, // 4 dias
        ],
      }),
    );
    expect(m.tempoMedioAteEncerramentoMs).toBe(3 * DAY);
  });

  it('sem amostra ⇒ tempos médios são null (jamais inventa)', () => {
    const m = computeOperationalMetrics(base());
    expect(m.tempoMedioEntreInteracoesMs).toBeNull();
    expect(m.tempoMedioAteEncerramentoMs).toBeNull();
  });

  it('casos por etapa = etapa atual (último passo); casos por advogado repassado', () => {
    const m = computeOperationalMetrics(
      base({
        progresses: [
          { steps: ['acompanhamento', 'documento_reconhecido', 'advogado'] },
          { steps: ['acompanhamento'] },
          { steps: [] },
        ],
        casesByAdvogado: { 'Dra. Ana': 3, 'Dr. Bruno': 1 },
      }),
    );
    expect(m.casosPorEtapa).toEqual({ advogado: 1, acompanhamento: 1, sem_etapa: 1 });
    expect(m.casosPorAdvogado).toEqual({ 'Dra. Ana': 3, 'Dr. Bruno': 1 });
  });

  it('casos aguardando cliente = clientes com documentos pendentes', () => {
    const m = computeOperationalMetrics(
      base({
        interactions: [
          { messageCount: 2, firstContactAt: null, lastContactAt: null, documentsPending: 2 },
          { messageCount: 2, firstContactAt: null, lastContactAt: null, documentsPending: 0 },
          { messageCount: 2, firstContactAt: null, lastContactAt: null, documentsPending: 1 },
        ],
      }),
    );
    expect(m.casosAguardandoCliente).toBe(2);
  });
});
