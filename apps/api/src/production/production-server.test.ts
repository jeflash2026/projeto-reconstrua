// ─────────────────────────────────────────────────────────────────────────────
// Testes de PRODUÇÃO (4A) — config persistida com segredos mascarados e merge,
// monitor com dados reais, GO-LIVE bloqueante (vermelho ⇒ bloqueado; ambiente
// completo ⇒ pronto) e o fluxo REAL_FIRST_CLIENT ponta a ponta (8 etapas).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { ProductionConfig } from '@reconstrua/application';
import { DEFAULT_PRODUCTION_CONFIG } from '@reconstrua/application';
import { assembleProduction, FakeSleeper, InMemoryConversationGateway } from '@reconstrua/infrastructure';
import { buildProductionServer } from './production-server.js';

class TestClock implements Clock {
  private t = new Date('2026-07-14T08:00:00.000Z');
  now(): Date {
    return new Date(this.t.getTime());
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

function harness(env: Record<string, string> = {}) {
  const clock = new TestClock();
  const gateway = new InMemoryConversationGateway(clock);
  const prod = assembleProduction({ clock, uuid: new SeqUuid(), env, gateway, sleeper: new FakeSleeper() });
  const app = buildProductionServer({ prod, env, startedAt: clock.now() });
  return { prod, app, gateway, clock };
}

describe('Produção — Admin Config', () => {
  it('GET mascara segredos; PUT persiste; campos mascarados não sobrescrevem segredos', async () => {
    const { app, prod } = harness();
    const full: ProductionConfig = {
      ...DEFAULT_PRODUCTION_CONFIG,
      evolution: { baseUrl: 'https://evo.x.com', instance: 'ahri', apiKey: 'SEGREDO-EVOLUTION-123', whatsappNumber: '5511999999999' },
      llm: { ...DEFAULT_PRODUCTION_CONFIG.llm, provider: 'anthropic', anthropicApiKey: 'sk-ant-SEGREDO' },
      publicUrl: 'https://ahrios.com.br',
    };
    await app.inject({ method: 'PUT', url: '/production/config', payload: full });

    const got = await app.inject({ method: 'GET', url: '/production/config' });
    const masked: ProductionConfig = got.json();
    expect(masked.evolution.apiKey).toContain('••••');
    expect(masked.evolution.apiKey).not.toContain('SEGREDO-EVOLUTION-123');
    expect(masked.llm.anthropicApiKey).toContain('••••');

    // Editar SÓ o prompt, reenviando o config mascarado: segredos preservados.
    const edited = { ...masked, prompts: { ...masked.prompts, global: 'NOVO PROMPT GLOBAL' } };
    await app.inject({ method: 'PUT', url: '/production/config', payload: edited });
    const stored = await prod.configStore.load();
    expect(stored?.prompts.global).toBe('NOVO PROMPT GLOBAL');
    expect(stored?.evolution.apiKey).toBe('SEGREDO-EVOLUTION-123'); // NÃO sobrescrito pela máscara
  });
});

describe('Produção — GO-LIVE bloqueante', () => {
  it('ambiente incompleto ⇒ PRODUÇÃO BLOQUEADA com os itens vermelhos nomeados', async () => {
    const { app } = harness({});
    const res = await app.inject({ method: 'GET', url: '/production/go-live' });
    const report: { ready: boolean; results: Array<{ item: string; passed: boolean }> } = res.json();
    expect(report.ready).toBe(false);
    const failed = report.results.filter((r) => !r.passed).map((r) => r.item);
    expect(failed).toContain('postgres');
    expect(failed).toContain('https');
    expect(failed).toContain('env-vars');
    expect(failed).toContain('llm');
  });

  it('itens estruturais passam mesmo offline (workers/scheduler/read-models/dispatcher/event-store/redis)', async () => {
    const { app } = harness({});
    const res = await app.inject({ method: 'GET', url: '/production/go-live' });
    const report: { results: Array<{ item: string; passed: boolean }> } = res.json();
    const ok = (item: string): boolean => report.results.find((r) => r.item === item)?.passed === true;
    for (const item of ['workers', 'scheduler', 'read-models', 'dispatcher', 'event-store', 'redis', 'health']) {
      expect(ok(item), item).toBe(true);
    }
  });
});

describe('Produção — REAL_FIRST_CLIENT (homologação ponta a ponta)', () => {
  it('executa as 8 etapas: anúncio→whatsapp→dados→HISCON→reconhecimento→missão→admin→workflow', async () => {
    const { app } = harness();
    const res = await app.inject({
      method: 'POST',
      url: '/production/first-client',
      payload: { chatId: '5511988887777@s.whatsapp.net', campaign: 'META-CAMPANHA-01' },
    });
    const report: { flow: string; passed: boolean; stages: Array<{ stage: string; passed: boolean; evidence: string }> } = res.json();

    expect(report.flow).toBe('REAL_FIRST_CLIENT');
    const names = report.stages.map((s) => s.stage);
    expect(names).toEqual([
      'anuncio',
      'whatsapp',
      'coleta_dados',
      'coleta_hiscon',
      'reconhecimento',
      'missao_criada',
      'admin_recebe',
      'workflow_continua',
    ]);
    for (const stage of report.stages) {
      expect(stage.passed, `${stage.stage}: ${stage.evidence}`).toBe(true);
    }
    expect(report.passed).toBe(true);
  });
});

describe('Produção — Monitor e UI', () => {
  it('monitor mostra dados reais (conversas, filas, LLM, health)', async () => {
    const { app } = harness();
    await app.inject({ method: 'POST', url: '/production/first-client', payload: {} });
    const res = await app.inject({ method: 'GET', url: '/production/monitor' });
    const m: { conversations: number; queues: { scheduler: number }; llm: { provider: string }; health: string } = res.json();
    expect(m.conversations).toBeGreaterThanOrEqual(1);
    expect(m.queues.scheduler).toBeGreaterThanOrEqual(1);
    expect(m.llm.provider).toBe('offline');
    expect(['ONLINE', 'OFFLINE', 'DEGRADED']).toContain(m.health);
  });

  it('/production/ui serve a página (monitor+config) sem tocar o portal congelado', async () => {
    const { app } = harness();
    const res = await app.inject({ method: 'GET', url: '/production/ui' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Monitor de Produção');
    expect(res.body).toContain('REAL_FIRST_CLIENT');
  });

  it('webhook de produção responde ACK imediato', async () => {
    const { app } = harness();
    const res = await app.inject({ method: 'POST', url: '/webhook/evolution', payload: { foo: 'bar' } });
    expect(res.statusCode).toBe(200);
    const ack: { ok: boolean } = res.json();
    expect(ack.ok).toBe(true);
  });
});
