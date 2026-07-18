// ─────────────────────────────────────────────────────────────────────────────
// /admin/dashboard × REGISTROS LEGADOS — regressão PERMANENTE da estabilização.
// O volume Postgres de produção contém registros gravados por builds antigos com
// CAMPOS AUSENTES (provado: documentsPending → 500; lastContactAt → 500 em
// undefined.getTime()). Este harness monta a rota com os MESMOS adapters de
// produção (Json* sobre JsonStore) semeados com formas legadas reais — inclusive
// o caso extremo (só chatId) — e exige HTTP 200 com números coerentes.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  InMemoryJsonStore,
  JsonMemoryStore,
  JsonMetricsStore,
  JsonHandoffStore,
  InMemoryEventStore,
  CryptoHasher,
  SystemClock,
  UuidV4Generator,
  type AssembledAdminOperation,
} from '@reconstrua/infrastructure';
import {
  AdministrationIntelligenceRuntime,
  HumanHandoffRuntime,
  ObservabilityRuntime,
  HealthRuntime,
  TimelineProjector,
} from '@reconstrua/application';
import { buildAdminServer } from './admin-server.js';

const ADMIN_SECRET = 'TEST-ADMIN-SECRET';

describe('/admin/dashboard com registros legados (formas reais de builds antigos)', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    const json = new InMemoryJsonStore();

    // ── Seeds LEGADOS (como estão no Postgres de produção) ──────────────────────
    // 1) client-memory sem documentsPending e sem lastContactAt (causas provadas).
    void json.put('client-memory', 'leg1@c.us', {
      chatId: 'leg1@c.us',
      attributes: [],
      rememberedEvents: [],
      emotionsObserved: [],
      documentsSent: [],
      stagesCompleted: [],
      conversationStyle: null,
      avgResponseMs: null,
      messageCount: 2,
      firstContactAt: '2026-07-01T10:00:00.000Z',
    });
    // 2) caso EXTREMO: registro só com chatId (todos os demais campos ausentes).
    void json.put('client-memory', 'leg2@c.us', { chatId: 'leg2@c.us' });
    // 3) registro moderno completo (não pode ser distorcido pela normalização).
    void json.put('client-memory', 'novo@c.us', {
      chatId: 'novo@c.us',
      attributes: [],
      rememberedEvents: [],
      emotionsObserved: [],
      documentsSent: [],
      documentsPending: ['CNIS'],
      stagesCompleted: [],
      conversationStyle: null,
      avgResponseMs: null,
      responseSampleCount: 0,
      lastOutboundAt: null,
      messageCount: 5,
      firstContactAt: '2026-07-10T10:00:00.000Z',
      lastContactAt: '2026-07-17T10:00:00.000Z',
    });
    // 4) admin-metrics LEGADO: só um campo (sem documentsByDay/processedByStream/…).
    void json.put('admin-metrics', 'current', { clientCount: 5 });

    // ── A rota montada com os adapters REAIS de produção ────────────────────────
    const clock = new SystemClock();
    const metricsStore = new JsonMetricsStore(json);
    const memoryStore = new JsonMemoryStore(json);
    const op = {
      projector: new TimelineProjector(new InMemoryEventStore(new CryptoHasher(), new UuidV4Generator(), clock)),
      metricsStore,
      memoryStore,
      observability: new ObservabilityRuntime(),
      admin: new AdministrationIntelligenceRuntime(metricsStore, memoryStore),
      handoff: new HumanHandoffRuntime(new JsonHandoffStore(json)),
      health: new HealthRuntime(),
    } as unknown as AssembledAdminOperation;

    app = buildAdminServer(op, { accessSecret: ADMIN_SECRET });
  });

  it('responde 200 e números coerentes mesmo com registros legados', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/dashboard',
      headers: { authorization: `Bearer ${ADMIN_SECRET}` },
    });
    expect(res.statusCode).toBe(200);

    const body: {
      activeClients: number;
      awaitingDocuments: number;
      messageCount: number;
      bottlenecks: string;
      alerts: string;
      overall: string;
    } = res.json();
    expect(body.activeClients).toBe(5); // do admin-metrics legado
    expect(body.awaitingDocuments).toBe(1); // só o registro moderno tem pendência
    expect(body.messageCount).toBe(7); // 2 + 0 (extremo normalizado) + 5
    expect(typeof body.bottlenecks).toBe('string');
    expect(typeof body.alerts).toBe('string');
  });
});
