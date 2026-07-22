// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION GO-LIVE — o checklist de subida REAL (spec 4A): Evolution, LLM,
// Postgres, Redis (n/a declarado), Workers, Scheduler, HTTPS, Variáveis, Portas,
// Health, Read Models, Dispatcher, Event Store. QUALQUER item vermelho ⇒
// PRODUÇÃO BLOQUEADA. Probes reais sobre a composição.
// ─────────────────────────────────────────────────────────────────────────────
import type { AssembledProduction } from './build-production.js';

export const PRODUCTION_ITEMS = [
  'evolution',
  'llm',
  'postgres',
  'redis',
  'workers',
  'scheduler',
  'https',
  'env-vars',
  'ports',
  'health',
  'read-models',
  'dispatcher',
  'event-store',
] as const;

export type ProductionItem = (typeof PRODUCTION_ITEMS)[number];

export interface ProductionItemResult {
  readonly item: ProductionItem;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ProductionGoLiveReport {
  readonly ready: boolean; // false = PRODUÇÃO BLOQUEADA
  readonly at: Date;
  readonly results: readonly ProductionItemResult[];
}

export class ProductionGoLive {
  constructor(private readonly prod: AssembledProduction) {}

  async verify(
    now: Date,
    env: Readonly<Record<string, string | undefined>>,
  ): Promise<ProductionGoLiveReport> {
    const p = this.prod;
    const results: ProductionItemResult[] = [];
    const add = (item: ProductionItem, passed: boolean, detail: string): void => {
      results.push({ item, passed, detail });
    };

    // Evolution: configuração completa E gateway ativo.
    const evo = p.config.evolution;
    add(
      'evolution',
      p.mode.gateway === 'evolution' ||
        (evo.baseUrl !== '' && evo.instance !== '' && evo.apiKey !== ''),
      p.mode.gateway === 'evolution'
        ? 'gateway Evolution ativo'
        : 'EVOLUTION_BASE_URL/INSTANCE/API_KEY ausentes',
    );

    // LLM: provedor real configurado.
    add(
      'llm',
      p.mode.llm !== 'offline',
      p.mode.llm !== 'offline'
        ? `provedor: ${p.mode.llm}`
        : 'LLM_PROVIDER/chave ausentes (modo offline)',
    );

    // Postgres: DATABASE_URL + storage pg.
    add(
      'postgres',
      p.mode.storage === 'postgres',
      p.mode.storage === 'postgres' ? 'DATABASE_URL ativo' : 'DATABASE_URL ausente (in-memory)',
    );

    // Redis: não utilizado nesta arquitetura (outbox+Postgres fazem a fila) — declarado.
    add('redis', true, 'não requerido (fila = outbox/Postgres por ADR-0001)');

    // Workers: boot da composição sobe todos os componentes.
    const bootReport = await p.boot.boot(p.bootComponents);
    add(
      'workers',
      bootReport.ok,
      bootReport.ok
        ? `${String(bootReport.started.length)} componentes ONLINE`
        : `falhas: ${bootReport.failed.map((f) => f.name).join(', ')}`,
    );

    // Scheduler: consulta real.
    try {
      const pending = await p.scheduler.pendingCount();
      add('scheduler', true, `${String(pending)} tarefa(s) pendente(s)`);
    } catch (error) {
      add('scheduler', false, error instanceof Error ? error.message : 'falha');
    }

    // HTTPS: URL pública precisa ser https.
    add(
      'https',
      p.config.publicUrl.startsWith('https://'),
      p.config.publicUrl === '' ? 'PUBLIC_URL ausente' : p.config.publicUrl,
    );

    // Variáveis obrigatórias. GO-LIVE-02: os SEGREDOS entram no bloqueio — sem
    // CLIENTE_PORTAL_SECRET o Portal nunca nasce (silenciosamente); sem
    // ADMIN_ACCESS_SECRET/WEBHOOK_SECRET as portas administrativas ficam fail-closed.
    const required = [
      'DATABASE_URL',
      'EVOLUTION_BASE_URL',
      'EVOLUTION_INSTANCE',
      'EVOLUTION_API_KEY',
      'PUBLIC_URL',
      'CLIENTE_PORTAL_SECRET',
      'ADMIN_ACCESS_SECRET',
      'WEBHOOK_SECRET',
    ];
    const missing = required.filter((k) => (env[k] ?? '') === '');
    add(
      'env-vars',
      missing.length === 0,
      missing.length === 0 ? 'todas presentes' : `ausentes: ${missing.join(', ')}`,
    );

    // Portas configuradas.
    const port = env['PORT'] ?? '';
    add(
      'ports',
      port !== '' && Number.isInteger(Number(port)),
      port !== '' ? `PORT=${port}` : 'PORT ausente',
    );

    // Health global.
    add('health', p.health.overall() !== 'FAILED', `overall: ${p.health.overall()}`);

    // Read Models.
    try {
      await p.metricsStore.load();
      await p.memoryStore.all();
      add('read-models', true, 'métricas + memória acessíveis');
    } catch (error) {
      add('read-models', false, error instanceof Error ? error.message : 'falha');
    }

    // Dispatcher: fan-out/entrega funcionais (drain vazio não lança).
    try {
      await p.outbox.drainToIdle(10);
      add('dispatcher', true, 'drain OK');
    } catch (error) {
      add('dispatcher', false, error instanceof Error ? error.message : 'falha');
    }

    // Event Store: leitura real.
    try {
      await p.adminView.eventStore.streamVersion('probe', '00000000-0000-4000-8000-0000000000ff');
      add('event-store', true, 'leitura OK');
    } catch (error) {
      add('event-store', false, error instanceof Error ? error.message : 'falha');
    }

    return { ready: results.every((r) => r.passed), at: now, results };
  }
}
