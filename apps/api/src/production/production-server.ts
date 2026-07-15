// ─────────────────────────────────────────────────────────────────────────────
// buildProductionServer — o servidor da OPERAÇÃO REAL: webhook Evolution (mesmo
// mapAndProcess de 2B), Admin Config (persistida, segredos mascarados), Monitor de
// Produção em tempo real, Go-Live Checklist (bloqueante) e o fluxo
// REAL_FIRST_CLIENT (homologação). Inclui UI mínima em /production/ui (servida
// pela API — o portal congelado permanece intocado). `.listen` é do dono.
// ─────────────────────────────────────────────────────────────────────────────
import Fastify, { type FastifyInstance } from 'fastify';
import type { AssembledProduction } from '@reconstrua/infrastructure';
import {
  PRODUCTION_RULE_CATALOG,
  ProductionGoLive,
  RealFirstClientFlow,
  askShadow,
  detect,
  mapEvolutionUpsert,
  summarize,
} from '@reconstrua/infrastructure';
import { configFromEnv, maskConfig, mergeConfigUpdate, type ProductionConfig } from '@reconstrua/application';
import { PRODUCTION_UI_HTML } from './production-ui.js';

export interface ProductionServerDeps {
  readonly prod: AssembledProduction;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly startedAt: Date;
}

export function buildProductionServer(deps: ProductionServerDeps): FastifyInstance {
  const { prod, env } = deps;
  const app = Fastify({ logger: false });

  app.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('access-control-allow-origin', '*');
    reply.header('access-control-allow-methods', 'GET,POST,PUT,OPTIONS');
    reply.header('access-control-allow-headers', 'content-type');
    done();
  });
  app.options('/*', (_request, reply) => {
    void reply.code(204).send();
  });

  // ── WEBHOOK Evolution (produção): ACK imediato; turno destacado entra pela
  //    ENTRADA ÚNICA serializada por conversa (correção A2/4C) ──────────────────
  app.post('/webhook/evolution', (request) => {
    const envelope = mapEvolutionUpsert(request.body);
    if (envelope) {
      void prod.ingress.receive(envelope).catch((error: unknown) => {
        prod.observability.error('webhook', 'evolution', new Date(), error instanceof Error ? error.message : 'falha');
      });
    }
    return { ok: true };
  });

  // ── ADMIN CONFIG (persistida; segredos mascarados no GET; merge no PUT) ──────
  app.get('/production/config', async () => {
    const stored = await prod.configStore.load();
    return maskConfig(stored ?? prod.config);
  });

  app.put('/production/config', async (request) => {
    const current = (await prod.configStore.load()) ?? prod.config;
    const update = request.body as ProductionConfig;
    const merged = mergeConfigUpdate(current, update);
    await prod.configStore.save(merged);
    prod.observability.event('config', 'updated', new Date());
    return { ok: true, config: maskConfig(merged), note: 'reinicie o processo para aplicar provedores (LLM/Evolution)' };
  });

  // ── MONITOR DE PRODUÇÃO (tempo real; só read models/observabilidade) ─────────
  app.get('/production/monitor', async () => {
    const now = new Date();
    const memories = await prod.memoryStore.all();
    const stats = prod.observability.stats();
    const uptimeS = Math.max(1, (now.getTime() - deps.startedAt.getTime()) / 1000);
    const trail = prod.observability.trail();
    const llmCalls = trail.filter((o) => o.component === 'llm' && o.kind === 'latency');
    return {
      mode: prod.mode,
      clientsOnline: memories.filter((m) => m.lastContactAt !== null && now.getTime() - (m.lastContactAt?.getTime() ?? 0) < 30 * 60_000).length,
      conversations: memories.length,
      queues: {
        scheduler: await prod.scheduler.pendingCount(),
        advogado: (await prod.adminView.handoff.openFor('advogado')).length,
        perito: (await prod.adminView.handoff.openFor('perito')).length,
      },
      eventsPerSecond: stats.totalEvents / uptimeS,
      llm: {
        provider: prod.mode.llm,
        calls: llmCalls.length,
        avgLatencyMs: llmCalls.length === 0 ? null : llmCalls.reduce((s, o) => s + (o.value ?? 0), 0) / llmCalls.length,
        errors: trail.filter((o) => o.component === 'llm' && o.kind === 'error').length,
      },
      latencyAvgMs: stats.avgLatencyMs,
      workers: prod.health.all().map((h) => ({ component: h.component, status: h.status })),
      health: prod.health.overall(),
      uptimeSeconds: Math.round(uptimeS),
    };
  });

  // ── GO-LIVE CHECKLIST (bloqueante) ───────────────────────────────────────────
  app.get('/production/go-live', async () => new ProductionGoLive(prod).verify(new Date(), env));

  // ── REAL_FIRST_CLIENT (homologação ponta a ponta) ────────────────────────────
  app.post('/production/first-client', async (request) => {
    const body = request.body as { chatId?: string; campaign?: string } | null;
    const chatId = body?.chatId ?? `homolog-${String(Date.now())}@s.whatsapp.net`;
    return new RealFirstClientFlow(prod).run(chatId, body?.campaign ?? 'META-HOMOLOG');
  });

  // ── SHADOW CENTER (4D): tudo auditável, em tempo real, dos Shadow Reports ────
  app.get('/production/shadow/center', async () => {
    const reports = await prod.shadowStore.all();
    const catalogRefs = PRODUCTION_RULE_CATALOG.map((r) => r.ref);
    return {
      shadowMode: prod.shadowMode,
      summary: summarize(reports),
      detections: detect(reports, catalogRefs),
      recent: reports.slice(-50),
    };
  });

  app.get('/production/shadow/reports', async (request) => {
    const { chatId, limit } = request.query as { chatId?: string; limit?: string };
    const reports = chatId ? await prod.shadowStore.byChat(chatId) : await prod.shadowStore.all();
    return reports.slice(-(Number(limit ?? '200') || 200));
  });

  app.post('/production/shadow/reports/:id/feedback', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { feedback?: string };
    if (!body.feedback) return reply.code(400).send({ error: 'feedback obrigatório' });
    const updated = await prod.shadow.addFeedback(id, body.feedback);
    if (!updated) return reply.code(404).send({ error: 'report não encontrado' });
    return updated;
  });

  app.post('/production/shadow/ask', async (request, reply) => {
    const body = request.body as { question?: string };
    if (!body.question) return reply.code(400).send({ error: 'pergunta obrigatória' });
    const reports = await prod.shadowStore.all();
    const detections = detect(reports, PRODUCTION_RULE_CATALOG.map((r) => r.ref));
    // Carga por advogado (read model 3B) e documentos pendentes (memória viva).
    const lawyerLoad: Record<string, number> = {};
    for (const member of await prod.advogadoView.staff.list('advogado')) {
      lawyerLoad[member.name] = (await prod.advogadoView.work.myMissions(member.id)).length;
    }
    const now = Date.now();
    const pendingDocs = (await prod.memoryStore.all()).flatMap((m) =>
      m.documentsPending.map((d) => ({
        chatId: m.chatId,
        document: d,
        sinceDays: m.lastContactAt ? Math.floor((now - m.lastContactAt.getTime()) / 86_400_000) : null,
      })),
    );
    return askShadow(body.question, { reports, detections, lawyerLoad, pendingDocs });
  });

  // ── Raiz do domínio: serve a MESMA UI (evita 404 "Route GET:/ not found" quando
  //    o proxy externo aponta o domínio para a porta main da API) ────────────────
  app.get('/', (_request, reply) => {
    void reply.type('text/html').send(PRODUCTION_UI_HTML);
  });

  // ── UI mínima (Monitor + Config) servida pela API — portal congelado intocado ─
  app.get('/production/ui', (_request, reply) => {
    void reply.type('text/html').send(PRODUCTION_UI_HTML);
  });

  app.get('/production/health', () => ({ overall: prod.health.overall(), components: prod.health.all() }));

  return app;
}

export { configFromEnv };
