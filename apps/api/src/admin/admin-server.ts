// ─────────────────────────────────────────────────────────────────────────────
// buildAdminServer — a API do Portal Administrativo. TODAS as rotas servem READ
// MODELS (métricas, memória, relationship, timeline projetada, workflow, health,
// observabilidade) — o portal NUNCA consulta o Event Store diretamente (item 12).
// Escritas: apenas o diretório operacional da equipe (staff) e as perguntas ao
// Founder Console (leitura narrada). NÃO inicia servidor (o `.listen` é do dono).
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AssembledAdminOperation } from '@reconstrua/infrastructure';
import { computeOperationalMetrics, type StaffRole } from '@reconstrua/application';
import { requireBearer } from '../auth/bearer-guard.js';

const STAFF_ROLES: readonly StaffRole[] = ['advogado', 'perito', 'operador', 'supervisor', 'administrador'];

function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export function buildAdminServer(op: AssembledAdminOperation, opts: { readonly accessSecret?: string } = {}): FastifyInstance {
  const app = Fastify({ logger: false });

  // CORS simples (portal em origem própria); sem dependência externa.
  app.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('access-control-allow-origin', '*');
    reply.header('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
    reply.header('access-control-allow-headers', 'content-type,authorization');
    done();
  });
  app.options('/*', (_request, reply) => {
    void reply.code(204).send();
  });

  // BL-2.1 — Autenticação Real (DF-12): toda rota /admin/* exige o segredo do Admin
  // (Bearer). Fail-closed: segredo ausente ⇒ 401. Guard REUTILIZÁVEL (Onda 3: advogado).
  requireBearer(app, { secret: opts.accessSecret ?? '', protect: (path) => path.startsWith('/admin/') });

  // ── DASHBOARD ────────────────────────────────────────────────────────────────
  app.get('/admin/dashboard', async () => {
    await op.projector.refresh();
    const now = new Date();
    const metrics = await op.metricsStore.load();
    const memories = await op.memoryStore.all();
    const today = now.toISOString().slice(0, 10);

    const awaitingDocuments = memories.filter((m) => m.documentsPending.length > 0).length;
    const newToday = memories.filter((m) => (m.firstContactAt?.toISOString().slice(0, 10) ?? '') === today).length;
    const totalMessages = memories.reduce((sum, m) => sum + m.messageCount, 0);
    const stats = op.observability.stats();
    const bottlenecks = await op.admin.answer('bottlenecks', now);
    const sector = await op.admin.answer('sector_needing_attention', now);

    return {
      activeClients: metrics?.clientCount ?? 0,
      newClientsToday: newToday,
      awaitingDocuments,
      awaitingPericia: (await op.handoff.openFor('perito')).length,
      awaitingAdvogado: (await op.handoff.openFor('advogado')).length,
      processesDistributed: metrics?.processCount ?? 0,
      avgHandlingMs: stats.avgLatencyMs,
      messageCount: totalMessages,
      documentCount: metrics?.documentCount ?? 0,
      financialUnderAdministration: metrics?.financialUnderAdministration ?? null,
      expectedFees: null, // sem fonte de dados no domínio congelado — nunca inventado
      bottlenecks: bottlenecks.fact,
      alerts: sector.fact,
      health: op.health.all(),
      overall: op.health.overall(),
    };
  });

  // ── CLIENTES ────────────────────────────────────────────────────────────────
  app.get('/admin/clients', async (request) => {
    await op.projector.refresh();
    const { q } = request.query as { q?: string };
    const memories = await op.memoryStore.all();
    const query = (q ?? '').trim().toLowerCase();
    const filtered = query === ''
      ? memories
      : memories.filter(
          (m) =>
            m.chatId.toLowerCase().includes(query) ||
            m.attributes.some((a) => a.value.toLowerCase().includes(query)),
        );
    return filtered.map((m) => ({
      chatId: m.chatId,
      name: m.attributes.find((a) => a.key === 'name')?.value ?? null,
      firstContactAt: m.firstContactAt,
      lastContactAt: m.lastContactAt,
      messageCount: m.messageCount,
      pendingDocuments: m.documentsPending,
      missions: op.projector.missionsOf(m.chatId),
    }));
  });

  app.get('/admin/clients/:chatId', async (request, reply) => {
    await op.projector.refresh();
    const { chatId } = request.params as { chatId: string };
    const memory = await op.memoryStore.load(chatId);
    if (!memory) return reply.code(404).send({ error: 'cliente não encontrado' });
    const relationship = await op.relationship.context(chatId);
    const conversation = await op.conversationStore.recent(chatId, 100);
    const missionIds = op.projector.missionsOf(chatId);
    const missions = await Promise.all(
      missionIds.map(async (id) => ({ missionId: id, progress: await op.workflow.progress(id) })),
    );
    return { memory, relationship, conversation, missions };
  });

  // ── MISSÕES ─────────────────────────────────────────────────────────────────
  app.get('/admin/missions', async () => {
    await op.projector.refresh();
    return op.projector.missions();
  });

  app.get('/admin/missions/:missionId', async (request, reply) => {
    await op.projector.refresh();
    const { missionId } = request.params as { missionId: string };
    const timeline = op.projector.missionTimeline(missionId);
    if (timeline.length === 0) return reply.code(404).send({ error: 'missão não encontrada' });
    return {
      missionId,
      timeline,
      progress: await op.workflow.progress(missionId),
      chatId: op.projector.missions().find((m) => m.missionId === missionId)?.chatId ?? null,
    };
  });

  // B4.1 — ENCERRAMENTO OFICIAL do processo (ato humano do operador). Reutiliza o
  // Mission Runtime existente (op.mission) e a autenticação do Admin (BL-2.1). Deriva
  // o Estado terminal ENCERRADA (CloseMission); a partir daí o Brain PARA e todo
  // acompanhamento recorrente futuro fica bloqueado. Idempotente e compatível com
  // reabertura futura (B4.3). Não altera nenhuma rota existente.
  app.post('/admin/missions/:missionId/encerrar', async (request, reply) => {
    await op.projector.refresh();
    const { missionId } = request.params as { missionId: string };
    const body = (request.body ?? {}) as { reason?: string };
    const mission = op.projector.missions().find((m) => m.missionId === missionId);
    if (!mission) return reply.code(404).send({ error: 'missão não encontrada' });
    if (mission.chatId === null) return reply.code(409).send({ error: 'missão sem conversa associada' });

    const now = new Date();
    const result = await op.mission.execute(
      {
        chatId: mission.chatId,
        senderId: 'operador',
        messageId: randomUUID(),
        perceptKind: 'closure',
        text: body.reason?.trim() ? body.reason.trim() : 'encerramento operacional',
        mediaRef: null,
        fileName: null,
        mimeType: null,
        occurredAt: now,
      },
      [
        {
          useCase: 'CloseMission',
          references: ['encerramento'],
          decisor: 'operador',
          tipo: 'encerramento',
          fundamento: 'Estado Operacional terminal — ENCERRADA (DF-11); RO-R9-001',
          operationalRuleRef: 'RO-STOP-CONCLUDED-001',
        },
      ],
    );
    const outcome = result.outcomes.find((o) => o.useCase === 'CloseMission');
    if (!outcome || (!outcome.ok && !outcome.skipped)) {
      return reply.code(422).send({ error: outcome?.error ?? 'falha ao encerrar a missão' });
    }
    // Drena o outbox: projeta o encerramento (Estado terminal ENCERRADA) nos read
    // models AGORA — o caminho de conversa drena no full-loop; um comando direto não.
    // A partir daqui o Brain PARA e nenhum acompanhamento recorrente é enviado.
    await op.outbox.drainToIdle();
    return { missionId, closed: true, skipped: outcome.skipped, stateId: outcome.streamId };
  });

  // B4.3 — REABERTURA OFICIAL de um processo encerrado (ato humano do operador, quando
  // há fato jurídico legítimo). EVENTO append-only (ReopenMission) que limpa a
  // terminalidade; o drain re-arma o acompanhamento (Workflow) e a recorrência (B4.2)
  // volta a valer automaticamente. Mesmo padrão/auth de /encerrar; sem novo fluxo.
  app.post('/admin/missions/:missionId/reabrir', async (request, reply) => {
    await op.projector.refresh();
    const { missionId } = request.params as { missionId: string };
    const body = (request.body ?? {}) as { reason?: string };
    const mission = op.projector.missions().find((m) => m.missionId === missionId);
    if (!mission) return reply.code(404).send({ error: 'missão não encontrada' });
    if (mission.chatId === null) return reply.code(409).send({ error: 'missão sem conversa associada' });

    const now = new Date();
    const result = await op.mission.execute(
      {
        chatId: mission.chatId,
        senderId: 'operador',
        messageId: randomUUID(),
        perceptKind: 'reopening',
        text: body.reason?.trim() ? body.reason.trim() : 'reabertura operacional',
        mediaRef: null,
        fileName: null,
        mimeType: null,
        occurredAt: now,
      },
      [
        {
          useCase: 'ReopenMission',
          references: ['reabertura'],
          decisor: 'operador',
          tipo: 'reabertura',
          fundamento: 'Fato jurídico legítimo — retorno ao estado operacional; RO-R9-001',
          operationalRuleRef: 'RO-R9-001',
        },
      ],
    );
    const outcome = result.outcomes.find((o) => o.useCase === 'ReopenMission');
    if (!outcome || (!outcome.ok && !outcome.skipped)) {
      return reply.code(422).send({ error: outcome?.error ?? 'falha ao reabrir a missão' });
    }
    // Drena: projeta a reabertura (terminalidade limpa) e o Workflow re-arma o
    // acompanhamento — a recorrência (B4.2) volta a valer automaticamente.
    await op.outbox.drainToIdle();
    return { missionId, reopened: true, skipped: outcome.skipped, stateId: outcome.streamId };
  });

  // B4.4 — MÉTRICAS OPERACIONAIS DA RECORRÊNCIA. Indicadores para governar centenas
  // de processos simultâneos. AGREGA read models JÁ EXISTENTES (projeção de timeline,
  // Decision State, AdminMetrics, Scheduler, memória, progresso, atribuições) — nenhuma
  // projeção/store/persistência nova; nada é recalculado a partir do Event Store.
  app.get('/admin/metrics/operacional', async () => {
    await op.projector.refresh();
    const missions = op.projector.missions().map((m) => ({ missionId: m.missionId, createdAt: m.createdAt }));
    const terminals = op.decisionState
      ? (await op.decisionState.all()).map((r) => ({ missionId: r.missionId, terminalState: r.terminalState ?? null, updatedAt: r.updatedAt }))
      : [];
    const metrics = await op.metricsStore.load();
    const scheduler = await op.scheduler.counts();
    const memories = await op.memoryStore.all();
    const interactions = memories.map((m) => ({
      messageCount: m.messageCount,
      firstContactAt: m.firstContactAt,
      lastContactAt: m.lastContactAt,
      documentsPending: m.documentsPending.length,
    }));
    const progresses = await op.progressStore.all();

    // Casos por advogado: atribuições já existentes (StaffDirectory + trabalho jurídico).
    const casesByAdvogado: Record<string, number> = {};
    if (op.work) {
      const advogados = await op.staff.list('advogado');
      for (const a of advogados) {
        casesByAdvogado[a.name] = (await op.work.myMissions(a.id)).length;
      }
    }

    return computeOperationalMetrics({
      missions,
      terminals,
      reopenedCount: metrics?.reopenedCount ?? 0,
      scheduler: { pending: scheduler.pending, fired: scheduler.fired },
      interactions,
      progresses: progresses.map((p) => ({ steps: p.steps })),
      casesByAdvogado,
    });
  });

  // ── DOCUMENTOS / PERÍCIAS ───────────────────────────────────────────────────
  app.get('/admin/documents', async () => {
    await op.projector.refresh();
    const memories = await op.memoryStore.all();
    const pending = memories.flatMap((m) => m.documentsPending.map((d) => ({ chatId: m.chatId, document: d })));
    return { recognized: op.projector.allDocuments(), pending };
  });

  // CAT-02C: conteúdo REAL do documento por documentId — uso INTERNO (servidor admin,
  // porta não publicada). Rota nova; não altera nenhuma rota existente.
  app.get('/admin/documents/:documentId/content', async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const content = op.documentContent ? await op.documentContent.byDocumentId(documentId) : null;
    if (content === null) return reply.code(404).send({ error: 'documento sem conteudo disponivel' });
    return reply.header('content-type', content.mime).send(Buffer.from(content.bytes));
  });

  app.get('/admin/pericias', async () => {
    await op.projector.refresh();
    return { pericias: op.projector.allPericias(), queue: (await op.handoff.openFor('perito')).length };
  });

  // ── EQUIPE (diretório operacional) ──────────────────────────────────────────
  app.get('/admin/staff/:role', async (request, reply) => {
    const { role } = request.params as { role: string };
    if (!isStaffRole(role)) return reply.code(400).send({ error: 'papel inválido' });
    return { members: await op.staff.list(role), workload: await op.staff.workload(role) };
  });

  app.post('/admin/staff', async (request, reply) => {
    const body = request.body as { role?: string; name?: string; email?: string | null };
    if (!body.role || !isStaffRole(body.role) || !body.name) {
      return reply.code(400).send({ error: 'role e name são obrigatórios' });
    }
    return op.staff.register(body.role, body.name, body.email ?? null);
  });

  app.patch('/admin/staff/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; email?: string | null; active?: boolean };
    try {
      return await op.staff.update(id, body);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : 'não encontrado' });
    }
  });

  // ── CAMPANHAS / FINANCEIRO (read models; ausência explícita, nunca inventado) ─
  app.get('/admin/campaigns', async () => {
    const metrics = await op.metricsStore.load();
    return { attribution: metrics?.campaignAttribution ?? {}, available: Object.keys(metrics?.campaignAttribution ?? {}).length > 0 };
  });

  app.get('/admin/finance', async () => {
    const metrics = await op.metricsStore.load();
    return {
      financialUnderAdministration: metrics?.financialUnderAdministration ?? null,
      expectedFees: null,
      available: (metrics?.financialUnderAdministration ?? null) !== null,
    };
  });

  // ── FOUNDER CONSOLE ─────────────────────────────────────────────────────────
  app.get('/admin/founder/briefing', async () => op.founderConsole.briefing(null, new Date()));

  app.post('/admin/founder/ask', async (request, reply) => {
    const body = request.body as { question?: string };
    if (!body.question || body.question.trim() === '') {
      return reply.code(400).send({ error: 'pergunta obrigatória' });
    }
    return op.founderConsole.ask(body.question, new Date());
  });

  // ── LOGS / HEALTH / CONFIG ──────────────────────────────────────────────────
  app.get('/admin/logs', async (request) => {
    await op.projector.refresh();
    const { q, source } = request.query as { q?: string; source?: string };
    const events = op.projector.searchLog(q ?? '');
    const trail = op.observability
      .trail()
      .filter((o) => (source ? o.component === source : true))
      .filter((o) => {
        const query = (q ?? '').trim().toLowerCase();
        return query === '' || o.name.toLowerCase().includes(query) || o.component.toLowerCase().includes(query);
      })
      .slice(-200);
    return { events, observations: trail };
  });

  app.get('/admin/health', () => ({ overall: op.health.overall(), components: op.health.all() }));

  app.get('/admin/config', () => ({
    goLiveItems: 18,
    notificationPolicy: 'anti-spam por audiência×motivo',
    portalRoles: STAFF_ROLES,
  }));

  return app;
}
