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
import {
  assembleProduction,
  FakeSleeper,
  InMemoryConversationGateway,
} from '@reconstrua/infrastructure';
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

const OPERATOR_SECRET = 'TEST-OPERATOR-SECRET';
const WEBHOOK_SECRET = 'TEST-WEBHOOK-SECRET';

function harness(env: Record<string, string> = {}) {
  const clock = new TestClock();
  const gateway = new InMemoryConversationGateway(clock);
  // B5.1: segredos de operador/webhook presentes por padrão (fail-closed já provado à parte).
  const merged = { ADMIN_ACCESS_SECRET: OPERATOR_SECRET, WEBHOOK_SECRET, ...env };
  const prod = assembleProduction({
    clock,
    uuid: new SeqUuid(),
    env: merged,
    gateway,
    sleeper: new FakeSleeper(),
  });
  const app = buildProductionServer({ prod, env: merged, startedAt: clock.now() });
  // inject autenticado (Bearer do operador) — reflete o console com o segredo.
  const auth = (opts: { method: 'GET' | 'POST' | 'PUT'; url: string; payload?: object }) =>
    app.inject({ ...opts, headers: { authorization: `Bearer ${OPERATOR_SECRET}` } });
  return { prod, app, auth, gateway, clock };
}

describe('Produção — Admin Config', () => {
  it('GET mascara segredos; PUT persiste; campos mascarados não sobrescrevem segredos', async () => {
    const { auth, prod } = harness();
    const full: ProductionConfig = {
      ...DEFAULT_PRODUCTION_CONFIG,
      evolution: {
        baseUrl: 'https://evo.x.com',
        instance: 'ahri',
        apiKey: 'SEGREDO-EVOLUTION-123',
        whatsappNumber: '5511999999999',
      },
      llm: {
        ...DEFAULT_PRODUCTION_CONFIG.llm,
        provider: 'anthropic',
        anthropicApiKey: 'sk-ant-SEGREDO',
      },
      publicUrl: 'https://ahrios.com.br',
    };
    await auth({ method: 'PUT', url: '/production/config', payload: full });

    const got = await auth({ method: 'GET', url: '/production/config' });
    const masked: ProductionConfig = got.json();
    expect(masked.evolution.apiKey).toContain('••••');
    expect(masked.evolution.apiKey).not.toContain('SEGREDO-EVOLUTION-123');
    expect(masked.llm.anthropicApiKey).toContain('••••');

    // Editar SÓ o prompt, reenviando o config mascarado: segredos preservados.
    const edited = { ...masked, prompts: { ...masked.prompts, global: 'NOVO PROMPT GLOBAL' } };
    await auth({ method: 'PUT', url: '/production/config', payload: edited });
    const stored = await prod.configStore.load();
    expect(stored?.prompts.global).toBe('NOVO PROMPT GLOBAL');
    expect(stored?.evolution.apiKey).toBe('SEGREDO-EVOLUTION-123'); // NÃO sobrescrito pela máscara
  });
});

describe('Produção — GO-LIVE bloqueante', () => {
  it('ambiente incompleto ⇒ PRODUÇÃO BLOQUEADA com os itens vermelhos nomeados', async () => {
    const { auth } = harness({});
    const res = await auth({ method: 'GET', url: '/production/go-live' });
    const report: { ready: boolean; results: Array<{ item: string; passed: boolean }> } =
      res.json();
    expect(report.ready).toBe(false);
    const failed = report.results.filter((r) => !r.passed).map((r) => r.item);
    expect(failed).toContain('postgres');
    expect(failed).toContain('https');
    expect(failed).toContain('env-vars');
    expect(failed).toContain('llm');
    // GO-LIVE-02: o segredo do Portal do Cliente agora BLOQUEIA a subida quando
    // ausente (antes o sistema subia "verde" com o Portal silenciosamente morto).
    const envVars = report.results.find((r) => r.item === 'env-vars') as
      { detail?: string } | undefined;
    expect(envVars?.detail).toContain('CLIENTE_PORTAL_SECRET');
  });

  it('itens estruturais passam mesmo offline (workers/scheduler/read-models/dispatcher/event-store/redis)', async () => {
    const { auth } = harness({});
    const res = await auth({ method: 'GET', url: '/production/go-live' });
    const report: { results: Array<{ item: string; passed: boolean }> } = res.json();
    const ok = (item: string): boolean =>
      report.results.find((r) => r.item === item)?.passed === true;
    for (const item of [
      'workers',
      'scheduler',
      'read-models',
      'dispatcher',
      'event-store',
      'redis',
      'health',
    ]) {
      expect(ok(item), item).toBe(true);
    }
  });
});

describe('Produção — REAL_FIRST_CLIENT (homologação ponta a ponta)', () => {
  it('executa as 8 etapas: anúncio→whatsapp→dados→HISCON→reconhecimento→missão→admin→workflow', async () => {
    const { auth } = harness();
    const res = await auth({
      method: 'POST',
      url: '/production/first-client',
      payload: { chatId: '5511988887777@s.whatsapp.net', campaign: 'META-CAMPANHA-01' },
    });
    const report: {
      flow: string;
      passed: boolean;
      stages: Array<{ stage: string; passed: boolean; evidence: string }>;
    } = res.json();

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
    const { auth } = harness();
    await auth({ method: 'POST', url: '/production/first-client', payload: {} });
    const res = await auth({ method: 'GET', url: '/production/monitor' });
    const m: {
      conversations: number;
      queues: { scheduler: number };
      llm: { provider: string };
      health: string;
    } = res.json();
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

  it('webhook de produção responde ACK imediato (com segredo válido)', async () => {
    const { app } = harness();
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      payload: { foo: 'bar' },
      headers: { apikey: WEBHOOK_SECRET },
    });
    expect(res.statusCode).toBe(200);
    const ack: { ok: boolean } = res.json();
    expect(ack.ok).toBe(true);
  });
});

// B5.1 — SEGURANÇA DE PRODUÇÃO: rotas sensíveis exigem o segredo do operador;
// health/landing/UI seguem públicas; o webhook exige o segredo (fail-safe).
describe('Produção — B5.1 Segurança', () => {
  const sensitive: ReadonlyArray<{ method: 'GET' | 'POST' | 'PUT'; url: string }> = [
    { method: 'GET', url: '/production/monitor' },
    { method: 'GET', url: '/production/config' },
    { method: 'PUT', url: '/production/config' },
    { method: 'GET', url: '/production/go-live' },
    { method: 'POST', url: '/production/first-client' },
    { method: 'GET', url: '/production/shadow/center' },
    { method: 'GET', url: '/production/shadow/reports' },
    { method: 'POST', url: '/production/shadow/ask' },
  ];

  it('toda rota sensível SEM Bearer ⇒ 401', async () => {
    const { app } = harness();
    for (const r of sensitive) {
      const res = await app.inject({ method: r.method, url: r.url, payload: {} });
      expect(res.statusCode, r.url).toBe(401);
    }
  });

  it('rota sensível com Bearer ERRADO ⇒ 401', async () => {
    const { app } = harness();
    const res = await app.inject({
      method: 'GET',
      url: '/production/monitor',
      headers: { authorization: 'Bearer ERRADO' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rota sensível com Bearer correto ⇒ passa (não 401)', async () => {
    const { auth } = harness();
    const res = await auth({ method: 'GET', url: '/production/shadow/center' });
    expect(res.statusCode).toBe(200);
  });

  it('health, landing e a casca da UI permanecem PÚBLICAS (sem Bearer)', async () => {
    const { app } = harness();
    expect((await app.inject({ method: 'GET', url: '/production/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/production/ui' })).statusCode).toBe(200);
  });

  it('webhook SEM segredo ⇒ 401 e NÃO processa; com segredo errado ⇒ 401', async () => {
    const { app, gateway } = harness();
    const semSegredo = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      payload: { foo: 'bar' },
    });
    expect(semSegredo.statusCode).toBe(401);
    const errado = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      payload: { foo: 'bar' },
      headers: { apikey: 'ERRADO' },
    });
    expect(errado.statusCode).toBe(401);
    expect(gateway.texts()).toHaveLength(0);
  });

  it('webhook aceita o segredo via Authorization Bearer ou ?token= também', async () => {
    const { app } = harness();
    const viaBearer = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      payload: {},
      headers: { authorization: `Bearer ${WEBHOOK_SECRET}` },
    });
    expect(viaBearer.statusCode).toBe(200);
    const viaQuery = await app.inject({
      method: 'POST',
      url: `/webhook/evolution?token=${WEBHOOK_SECRET}`,
      payload: {},
    });
    expect(viaQuery.statusCode).toBe(200);
  });

  it('FAIL-CLOSED: sem ADMIN_ACCESS_SECRET nem WEBHOOK_SECRET/EVOLUTION_API_KEY ⇒ tudo sensível/webhook = 401', async () => {
    const clock = new TestClock();
    const gateway = new InMemoryConversationGateway(clock);
    const env: Record<string, string> = {}; // nenhum segredo
    const prod = assembleProduction({
      clock,
      uuid: new SeqUuid(),
      env,
      gateway,
      sleeper: new FakeSleeper(),
    });
    const app = buildProductionServer({ prod, env, startedAt: clock.now() });
    // Mesmo com um Bearer qualquer, o segredo vazio recusa (fail-closed).
    const monitor = await app.inject({
      method: 'GET',
      url: '/production/monitor',
      headers: { authorization: 'Bearer qualquer' },
    });
    expect(monitor.statusCode).toBe(401);
    const webhook = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      payload: {},
      headers: { apikey: 'qualquer' },
    });
    expect(webhook.statusCode).toBe(401);
  });
});

describe('Produção — Landing pública (GET /) injeta config do ambiente', () => {
  it('CTA usa EXCLUSIVAMENTE o número OFICIAL (ignora WHATSAPP_NUMBER); OAB/CNPJ do env', async () => {
    const { app } = harness({
      PUBLIC_URL: 'https://reconstrua.com.br',
      OFFICIAL_WHATSAPP_NUMBER: '55 41 3798-9737',
      WHATSAPP_NUMBER: '55 11 98888-7777', // NÃO deve aparecer na landing (desacoplado)
      OAB_IDENTIFICACAO: 'SP 123.456',
      CNPJ: '12.345.678/0001-90',
    });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    // O link wa.me é montado em JS no browser: o HTML traz `var WA = "<numero>"`.
    expect(res.body).toContain('var WA = "554137989737"'); // CTA = número OFICIAL
    expect(res.body).not.toContain('5511988887777'); // WHATSAPP_NUMBER é ignorado pela landing
    expect(res.body).toContain('OAB/UF: SP 123.456');
    expect(res.body).toContain('CNPJ: 12.345.678/0001-90');
    for (const ph of ['__URL__', '__WA__', '__OAB__', '__CNPJ__', '[preencher]']) {
      expect(res.body, ph).not.toContain(ph);
    }
  });

  it('sem OFFICIAL_WHATSAPP_NUMBER ⇒ CTA cai no default oficial 554137989737 (nunca placeholder cru)', async () => {
    const { app } = harness({});
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('var WA = "554137989737"'); // default oficial
    for (const ph of ['__URL__', '__WA__', '__OAB__', '__CNPJ__']) {
      expect(res.body, ph).not.toContain(ph);
    }
  });
});
