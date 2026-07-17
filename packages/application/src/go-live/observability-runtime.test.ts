// ─────────────────────────────────────────────────────────────────────────────
// Testes do ObservabilityRuntime (B5.3) — durabilidade por stdout/stderr:
//   • a trilha em memória é PRESERVADA (event/latency/error continuam em trail());
//   • cada observação passa pelo SINK exatamente uma vez (sem duplicação);
//   • o sink padrão emite SÓ erros e degradações (health) ao stderr; event/latency
//     /queue/stat NÃO vão ao stderr (sem flood);
//   • error() e degraded() produzem as observações corretas e são emitidas.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest';
import { ObservabilityRuntime, stderrErrorSink, type Observation } from './observability-runtime.js';

const NOW = new Date('2026-07-17T12:00:00.000Z');

describe('ObservabilityRuntime (B5.3) — sink durável + trilha preservada', () => {
  it('preserva a trilha em memória para TODOS os tipos (não perde nada)', () => {
    const obs = new ObservabilityRuntime(() => undefined); // sink no-op (não polui stderr no teste)
    obs.event('conv', 'turn', NOW);
    obs.latency('llm', 'call', 120, NOW);
    obs.error('http', 'timeout', NOW, 'ETIMEDOUT');
    const trail = obs.trail();
    expect(trail).toHaveLength(3);
    expect(trail.map((o) => o.kind)).toEqual(['event', 'latency', 'error']);
    expect(obs.stats().totalErrors).toBe(1);
  });

  it('cada observação passa pelo sink EXATAMENTE uma vez (sem duplicação)', () => {
    const seen: Observation[] = [];
    const obs = new ObservabilityRuntime((o) => seen.push(o));
    obs.event('c', 'e', NOW);
    obs.error('c', 'x', NOW, 'boom');
    obs.degraded('c', 'd', NOW, 'degradou');
    expect(seen).toHaveLength(3);
    expect(seen.filter((o) => o.kind === 'error')).toHaveLength(1);
    expect(seen.filter((o) => o.kind === 'health')).toHaveLength(1);
  });

  it('error() e degraded() geram as observações corretas', () => {
    const obs = new ObservabilityRuntime(() => undefined);
    obs.error('media', 'capture', NOW, 'falha');
    obs.degraded('go-live', 'degraded-start', NOW, 'itens vermelhos: llm');
    const trail = obs.trail();
    expect(trail[0]).toMatchObject({ kind: 'error', component: 'media', name: 'capture', detail: 'falha' });
    expect(trail[1]).toMatchObject({ kind: 'health', component: 'go-live', name: 'degraded-start' });
  });
});

describe('stderrErrorSink (B5.3) — só erros/degradações vão ao stderr', () => {
  const obsOf = (kind: Observation['kind']): Observation => ({ kind, component: 'c', name: 'n', value: null, detail: 'd', at: NOW });

  it('emite erro e degradação (health); ignora event/latency/queue/stat', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      stderrErrorSink(obsOf('error'));
      stderrErrorSink(obsOf('health'));
      stderrErrorSink(obsOf('event'));
      stderrErrorSink(obsOf('latency'));
      stderrErrorSink(obsOf('queue'));
      stderrErrorSink(obsOf('stat'));
      expect(spy).toHaveBeenCalledTimes(2); // só error + health
      const line = String(spy.mock.calls[0]?.[0] ?? '');
      expect(line).toContain('ERROR');
      expect(line).toContain('c/n');
      expect(line).toContain(':: d');
      expect(line.endsWith('\n')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('por padrão o runtime usa o stderr sink (durável) — um erro escreve uma linha', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const obs = new ObservabilityRuntime(); // sink padrão = stderr
      obs.event('c', 'e', NOW); // não emite
      obs.error('c', 'x', NOW, 'boom'); // emite 1 linha
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
