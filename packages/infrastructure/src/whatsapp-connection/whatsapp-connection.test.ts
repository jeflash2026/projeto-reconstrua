// ─────────────────────────────────────────────────────────────────────────────
// Testes da administração da conexão WhatsApp (EvolutionInstanceClient +
// WhatsAppConnectionRuntime). HTTP e stores são FALSOS (sem rede/DB). Provam:
// parse defensivo do QR/ownerJid, criação+webhook+persistência pendente, validação
// do número OFICIAL na confirmação (rejeita divergente), descarte e status.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type { ConfigStore, ProductionConfig } from '@reconstrua/application';
import { DEFAULT_PRODUCTION_CONFIG, ObservabilityRuntime } from '@reconstrua/application';
import { EvolutionInstanceClient, type EvoHttp, type EvoHttpResponse } from './evolution-instance-client.js';
import { WhatsAppConnectionRuntime } from './whatsapp-connection-runtime.js';

const OFFICIAL = '554137989737';
const WRONG = '5511989904824';

class FixedClock implements Clock {
  now(): Date {
    return new Date('2026-07-17T12:00:00.000Z');
  }
}

class MemConfigStore implements ConfigStore {
  private cfg: ProductionConfig | null = null;
  load(): Promise<ProductionConfig | null> {
    return Promise.resolve(this.cfg);
  }
  save(config: ProductionConfig): Promise<void> {
    this.cfg = config;
    return Promise.resolve();
  }
}

/** HTTP falso roteado por método+URL → resposta e gravação das chamadas. */
class FakeEvoHttp implements EvoHttp {
  readonly calls: Array<{ method: string; url: string; body?: unknown }> = [];
  constructor(private readonly routes: (method: string, url: string) => EvoHttpResponse) {}
  request(method: 'GET' | 'POST' | 'DELETE', url: string, _h: Readonly<Record<string, string>>, body?: unknown): Promise<EvoHttpResponse> {
    this.calls.push({ method, url, body });
    return Promise.resolve(this.routes(method, url));
  }
}

const cfg = { baseUrl: 'https://evo.test', globalApiKey: 'GLOBAL-KEY' };

describe('EvolutionInstanceClient — parse defensivo', () => {
  it('create devolve a apikey por-instância (campo hash)', async () => {
    const http = new FakeEvoHttp(() => ({ status: 201, body: { hash: 'INST-APIKEY' } }));
    const created = await new EvolutionInstanceClient(http, cfg).createInstance('reconstrua-prod');
    expect(created).toEqual({ instanceName: 'reconstrua-prod', apiKey: 'INST-APIKEY' });
    expect(http.calls[0]?.url).toBe('https://evo.test/instance/create');
  });

  it('connect extrai o base64 do QR (em qrcode.base64)', async () => {
    const http = new FakeEvoHttp(() => ({ status: 200, body: { qrcode: { base64: 'data:image/png;base64,AAA' } } }));
    const qr = await new EvolutionInstanceClient(http, cfg).connect('reconstrua-prod');
    expect(qr.base64).toBe('data:image/png;base64,AAA');
  });

  it('fetchInstance devolve ownerJid e estado', async () => {
    const http = new FakeEvoHttp(() => ({ status: 200, body: [{ name: 'reconstrua-prod', ownerJid: `${OFFICIAL}@s.whatsapp.net`, connectionStatus: 'open' }] }));
    const snap = await new EvolutionInstanceClient(http, cfg).fetchInstance('reconstrua-prod');
    expect(snap).toMatchObject({ name: 'reconstrua-prod', ownerJid: `${OFFICIAL}@s.whatsapp.net`, state: 'open' });
  });

  it('logout/delete usam DELETE nos endpoints certos', async () => {
    const http = new FakeEvoHttp(() => ({ status: 200, body: {} }));
    const c = new EvolutionInstanceClient(http, cfg);
    await c.logout('x'); await c.deleteInstance('x');
    expect(http.calls.map((k) => `${k.method} ${k.url}`)).toEqual(['DELETE https://evo.test/instance/logout/x', 'DELETE https://evo.test/instance/delete/x']);
  });
});

function runtime(routes: (m: string, u: string) => EvoHttpResponse, active = { instance: '', number: '' }) {
  const http = new FakeEvoHttp(routes);
  const store = new MemConfigStore();
  const client = new EvolutionInstanceClient(http, cfg);
  const rt = new WhatsAppConnectionRuntime({
    client, configStore: store, observability: new ObservabilityRuntime(() => undefined), clock: new FixedClock(),
    officialNumber: OFFICIAL, active, webhookUrl: 'https://reconstrua.com.br/webhook/evolution', webhookSecret: 'WH',
    management: { hasGlobalKey: true, hasFounderGate: true },
  });
  return { rt, http, store };
}

describe('WhatsAppConnectionRuntime', () => {
  it('createNew cria, configura webhook e persiste a instância como PENDENTE (número vazio)', async () => {
    const { rt, http, store } = runtime((_m, u) =>
      u.endsWith('/instance/create') ? { status: 201, body: { hash: 'K' } } :
      u.includes('/instance/connect/') ? { status: 200, body: { base64: 'QR' } } : { status: 200, body: {} },
    );
    const res = await rt.createNew('reconstrua-prod', { role: 'founder' });
    expect(res.qr.base64).toBe('QR');
    expect(http.calls.some((k) => k.url.endsWith('/webhook/set/reconstrua-prod'))).toBe(true);
    const saved = await store.load();
    expect(saved?.evolution).toMatchObject({ instance: 'reconstrua-prod', apiKey: 'K', whatsappNumber: '' });
  });

  it('confirm com número OFICIAL → conecta e grava o número na config pendente', async () => {
    const { rt, store } = runtime(() => ({ status: 200, body: [{ name: 'reconstrua-prod', ownerJid: `${OFFICIAL}@s.whatsapp.net`, connectionStatus: 'open' }] }));
    const r = await rt.confirm('reconstrua-prod', { role: 'admin' });
    expect(r).toMatchObject({ connected: true, number: OFFICIAL, matchesOfficial: true, error: null });
    expect((await store.load())?.evolution.whatsappNumber).toBe(OFFICIAL);
  });

  it('confirm com número DIVERGENTE → NÃO ativa e devolve o erro exato', async () => {
    const { rt, store } = runtime(() => ({ status: 200, body: [{ name: 'x', ownerJid: `${WRONG}@s.whatsapp.net`, connectionStatus: 'open' }] }));
    const r = await rt.confirm('x', { role: 'admin' });
    expect(r.connected).toBe(false);
    expect(r.matchesOfficial).toBe(false);
    expect(r.error).toBe('O número conectado não corresponde ao número oficial da empresa.');
    expect((await store.load())?.evolution.whatsappNumber ?? '').not.toBe(WRONG); // nunca persiste o errado
  });

  it('confirm com instância ainda desconectada → erro de "não conectada"', async () => {
    const { rt } = runtime(() => ({ status: 200, body: [{ name: 'x', ownerJid: null, connectionStatus: 'connecting' }] }));
    const r = await rt.confirm('x', { role: 'admin' });
    expect(r.connected).toBe(false);
    expect(r.error).toContain('não está conectada');
  });

  it('discard faz logout+delete e limpa a instância pendente', async () => {
    const { rt, http, store } = runtime(() => ({ status: 200, body: {} }));
    await store.save({ ...DEFAULT_PRODUCTION_CONFIG, evolution: { baseUrl: '', instance: 'velha', apiKey: 'k', whatsappNumber: WRONG } });
    await rt.discard('velha', { role: 'founder' });
    expect(http.calls.map((k) => k.method)).toEqual(['DELETE', 'DELETE']);
    expect((await store.load())?.evolution).toMatchObject({ instance: '', apiKey: '', whatsappNumber: '' });
  });

  it('getStatus expõe pendente≠ativa e matchesOfficial (sem segredos)', async () => {
    const { rt, store } = runtime(() => ({ status: 200, body: [{ name: 'reconstrua-prod', ownerJid: `${OFFICIAL}@s.whatsapp.net`, connectionStatus: 'open' }] }), { instance: 'velha', number: WRONG });
    await store.save({ ...DEFAULT_PRODUCTION_CONFIG, evolution: { baseUrl: '', instance: 'reconstrua-prod', apiKey: 'k', whatsappNumber: OFFICIAL } });
    const s = await rt.getStatus();
    expect(s.hasPendingApply).toBe(true);
    expect(s.pending).toEqual({ instance: 'reconstrua-prod', number: OFFICIAL });
    expect(s.matchesOfficial).toBe(true);
    expect(JSON.stringify(s)).not.toContain('GLOBAL-KEY'); // nunca vaza segredo
  });
});

// ── GO-LIVE-05 · BUG 2: DIAGNÓSTICO com a causa EXATA (nunca genérico) ─────────
describe('WhatsAppConnectionRuntime.diagnose — a causa real de cada dependência', () => {
  interface DiagOver {
    management?: { hasGlobalKey: boolean; hasFounderGate: boolean };
    diagnostics?: { baseUrl: string; db?: () => Promise<void>; queue?: () => Promise<number> };
  }
  function diagRuntime(http: EvoHttp, over: DiagOver = {}): WhatsAppConnectionRuntime {
    return new WhatsAppConnectionRuntime({
      client: new EvolutionInstanceClient(http, cfg),
      configStore: new MemConfigStore(),
      observability: new ObservabilityRuntime(() => undefined),
      clock: new FixedClock(),
      officialNumber: OFFICIAL,
      active: { instance: 'reconstrua-prod', number: OFFICIAL },
      webhookUrl: 'https://reconstrua.com.br/webhook/evolution',
      webhookSecret: 'WH',
      management: over.management ?? { hasGlobalKey: true, hasFounderGate: true },
      diagnostics: over.diagnostics ?? { baseUrl: 'https://evo.test', db: () => Promise.resolve(), queue: () => Promise.resolve(3) },
    });
  }

  it('TUDO OK: cada passo verde, com a instância presente e as filas contadas', async () => {
    const http = new FakeEvoHttp(() => ({ status: 200, body: [{ name: 'reconstrua-prod', connectionStatus: 'open' }] }));
    const report = await diagRuntime(http).diagnose();
    expect(report.ok).toBe(true);
    const byStep = Object.fromEntries(report.steps.map((s) => [s.step, s]));
    expect(byStep['Instância']?.detail).toContain('existe na Evolution');
    expect(byStep['Filas (outbox)']?.detail).toContain('3');
  });

  it('EVOLUTION 401: aponta EXATAMENTE a autenticação da chave global', async () => {
    const http = new FakeEvoHttp(() => ({ status: 401, body: { error: 'Unauthorized' } }));
    const report = await diagRuntime(http).diagnose();
    const auth = report.steps.find((s) => s.step === 'Autenticação (chave global)');
    expect(auth?.ok).toBe(false);
    expect(auth?.detail).toContain('401');
    expect(auth?.detail).toContain('EVOLUTION_GLOBAL_API_KEY');
    expect(report.ok).toBe(false);
  });

  it('CONNECTION REFUSED: transporte lança → a causa de rede real aparece', async () => {
    const throwing: EvoHttp = {
      request: () => Promise.reject(Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } })),
    };
    const report = await diagRuntime(throwing).diagnose();
    const conn = report.steps.find((s) => s.step === 'Conexão com a Evolution');
    expect(conn?.ok).toBe(false);
    expect(conn?.detail).toContain('conexão recusada');
  });

  it('DNS: ENOTFOUND vira mensagem de host não resolvido', async () => {
    const throwing: EvoHttp = {
      request: () => Promise.reject(Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })),
    };
    const report = await diagRuntime(throwing).diagnose();
    expect(report.steps.find((s) => s.step === 'Conexão com a Evolution')?.detail).toContain('DNS');
  });

  it('INSTÂNCIA inexistente: lista as encontradas e marca falha', async () => {
    const http = new FakeEvoHttp(() => ({ status: 200, body: [{ name: 'outra-instancia', connectionStatus: 'open' }] }));
    const inst = (await diagRuntime(http).diagnose()).steps.find((s) => s.step === 'Instância');
    expect(inst?.ok).toBe(false);
    expect(inst?.detail).toContain('NÃO existe');
    expect(inst?.detail).toContain('outra-instancia');
  });

  it('VARIÁVEIS ausentes: baseUrl e chave global vazios são apontados', async () => {
    const http = new FakeEvoHttp(() => ({ status: 200, body: [] }));
    const rt = diagRuntime(http, {
      management: { hasGlobalKey: false, hasFounderGate: false },
      diagnostics: { baseUrl: '', db: () => Promise.resolve(), queue: () => Promise.resolve(0) },
    });
    const vars = (await rt.diagnose()).steps.find((s) => s.step === 'Variáveis de ambiente');
    expect(vars?.ok).toBe(false);
    expect(vars?.detail).toContain('EVOLUTION_BASE_URL ausente');
    expect(vars?.detail).toContain('EVOLUTION_GLOBAL_API_KEY ausente');
  });

  it('BANCO indisponível: a exceção do Postgres vira o detalhe do passo (não engolida)', async () => {
    const http = new FakeEvoHttp(() => ({ status: 200, body: [{ name: 'reconstrua-prod' }] }));
    const rt = diagRuntime(http, {
      diagnostics: { baseUrl: 'https://evo.test', db: () => Promise.reject(new Error("connection to server failed")), queue: () => Promise.resolve(0) },
    });
    const db = (await rt.diagnose()).steps.find((s) => s.step === 'Banco de dados');
    expect(db?.ok).toBe(false);
    expect(db?.detail).toContain('connection to server failed');
  });
});
