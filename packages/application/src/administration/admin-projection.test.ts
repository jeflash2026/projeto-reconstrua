// ─────────────────────────────────────────────────────────────────────────────
// Testes da projeção administrativa — conta o que os eventos dizem, idempotente por
// globalSeq, documentos por dia. Determinística.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { emptyMetrics } from './admin-metrics.js';
import { projectEvent } from './admin-projection.js';
import type { StoredEvent } from '../event-store/index.js';

const NOW = new Date('2026-07-14T00:00:00.000Z');
const NOPROV = { factRef: null, actor: 'AHRI', decisionType: null, fundamento: null, operationalRuleRef: 'RO-X' };

function event(streamType: string, globalSeq: number, occurredAt: Date = NOW): StoredEvent {
  return {
    id: `e${String(globalSeq)}`,
    streamType,
    streamId: `${streamType}-1`,
    version: 1,
    eventType: `${streamType}.recognized`,
    isRelevant: true,
    payload: {},
    provenance: NOPROV,
    previousHash: null,
    hash: `h${String(globalSeq)}`,
    occurredAt,
    recordedAt: NOW,
    globalSeq,
  };
}

describe('projectEvent', () => {
  it('conta clientes, missões, processos e documentos', () => {
    let m = emptyMetrics(NOW);
    m = projectEvent(m, event('cliente', 1));
    m = projectEvent(m, event('mission', 2));
    m = projectEvent(m, event('process', 3));
    m = projectEvent(m, event('document', 4));
    expect(m.clientCount).toBe(1);
    expect(m.missionCount).toBe(1);
    expect(m.processCount).toBe(1);
    expect(m.documentCount).toBe(1);
    expect(m.documentsByDay['2026-07-14']).toBe(1);
    expect(m.lastGlobalSeq).toBe(4);
  });

  it('é idempotente por globalSeq (redelivery não conta duas vezes)', () => {
    let m = emptyMetrics(NOW);
    const e = event('cliente', 1);
    m = projectEvent(m, e);
    m = projectEvent(m, e); // mesma globalSeq
    expect(m.clientCount).toBe(1);
  });

  it('dados não capturados permanecem ausentes (nunca inventados)', () => {
    let m = emptyMetrics(NOW);
    m = projectEvent(m, event('mission', 1));
    expect(m.financialUnderAdministration).toBeNull();
    expect(Object.keys(m.perAdvogado)).toHaveLength(0);
    expect(Object.keys(m.campaignAttribution)).toHaveLength(0);
  });
});
