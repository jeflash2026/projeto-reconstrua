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
import { computeOperationalMetrics, prazoDosPedidos, type StaffRole } from '@reconstrua/application';
import { requireBearer, secretsMatch } from '../auth/bearer-guard.js';

const STAFF_ROLES: readonly StaffRole[] = ['advogado', 'perito', 'operador', 'supervisor', 'administrador'];

function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export function buildAdminServer(
  op: AssembledAdminOperation,
  opts: { readonly accessSecret?: string; readonly founderSecret?: string } = {},
): FastifyInstance {
  const app = Fastify({ logger: false });

  // [DEBUG-500] instrumentação TEMPORÁRIA (2ª rodada — remover após o diagnóstico):
  // stack completa de 5xx no stderr para confirmar se a origem mudou de linha após
  // a correção de 038fc26 ou se o código corrigido nem está em execução.
  app.setErrorHandler((error: unknown, request, reply) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const rawStatus = (err as { statusCode?: unknown }).statusCode;
    const status = typeof rawStatus === 'number' && rawStatus >= 400 ? rawStatus : 500;
    process.stderr.write(`[DEBUG-500] ${request.method} ${request.url}\n${err.stack ?? err.message}\n`);
    void reply.code(status).send({ statusCode: status, error: 'Internal Server Error', message: err.message });
  });

  // Gate FOUNDER (Super Admin) para operações DESTRUTIVAS de WhatsApp (criar/descartar
  // instância). Além da auth BL-2.1 (Bearer do Admin), exige o header `x-founder-secret`
  // = FOUNDER_ACCESS_SECRET, comparado em tempo constante. Fail-closed: segredo vazio ⇒ nega.
  const founderSecret = opts.founderSecret ?? '';
  const isFounder = (request: { headers: Record<string, unknown> }): boolean => {
    const presented = request.headers['x-founder-secret'];
    return founderSecret !== '' && typeof presented === 'string' && secretsMatch(presented, founderSecret);
  };

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

  // ── Regra 3 (permanente): uma ação operacional NUNCA recria lógica — reutiliza o
  // comando canônico. Helper ÚNICO do bloco execute(use case) → outcome → drain,
  // usado por /encerrar, /reabrir e /vender.
  interface MissionCommand {
    readonly chatId: string;
    readonly senderId: string;
    readonly perceptKind: 'closure' | 'reopening';
    readonly text: string;
    readonly useCase: 'CloseMission' | 'ReopenMission';
    readonly references: readonly string[];
    readonly decisor: string;
    readonly tipo: string;
    readonly fundamento: string;
    readonly operationalRuleRef: string;
  }
  async function runMissionCommand(
    cmd: MissionCommand,
  ): Promise<
    | { readonly ok: true; readonly skipped: boolean; readonly streamId: string | null }
    | { readonly ok: false; readonly error: string }
  > {
    const result = await op.mission.execute(
      {
        chatId: cmd.chatId,
        senderId: cmd.senderId,
        messageId: randomUUID(),
        perceptKind: cmd.perceptKind,
        text: cmd.text,
        mediaRef: null,
        fileName: null,
        mimeType: null,
        occurredAt: new Date(),
      },
      [
        {
          useCase: cmd.useCase,
          references: [...cmd.references],
          decisor: cmd.decisor,
          tipo: cmd.tipo,
          fundamento: cmd.fundamento,
          operationalRuleRef: cmd.operationalRuleRef,
        },
      ],
    );
    const outcome = result.outcomes.find((o) => o.useCase === cmd.useCase);
    if (!outcome || (!outcome.ok && !outcome.skipped)) {
      return { ok: false, error: outcome?.error ?? `falha ao executar ${cmd.useCase}` };
    }
    // Drena o outbox: projeta a consequência nos read models AGORA — um comando
    // direto não passa pelo full-loop de conversa (que drena sozinho).
    await op.outbox.drainToIdle();
    return { ok: true, skipped: outcome.skipped, streamId: outcome.streamId ?? null };
  }

  // ── JORNADA (GO LIVE A · R2) — lista única com status DERIVADO em leitura ────
  // `?fila=venda` devolve apenas a fila do Modelo A (PRONTO_AGUARDANDO_VENDA).
  app.get('/admin/jornada/clientes', async (request, reply) => {
    if (!op.clientes) return reply.code(503).send({ error: 'jornada indisponível nesta montagem' });
    const { fila } = request.query as { fila?: string };
    // As filas nomeadas do SO — todas DERIVADAS (Regra 1); B-R4 adiciona `socio`.
    const FILAS: Record<string, string> = {
      venda: 'PRONTO_AGUARDANDO_VENDA',
      pericia: 'PRONTO_AGUARDANDO_PERICIA',
      socio: 'AGUARDANDO_SOCIO',
    };
    const todos = await op.clientes.list();
    const status = fila !== undefined ? FILAS[fila] : undefined;
    const clientes = status !== undefined ? todos.filter((c) => c.status === status) : todos;
    return { clientes };
  });

  // ── JORNADA B (B-R2) — PERITO: contratos organizados + planilha (CSV hoje; a
  // troca por XLSX é só do exporter). Somente leitura; nada persistido.
  app.get('/admin/jornada/pericia/:clienteId/contratos', async (request, reply) => {
    if (!op.perito) return reply.code(503).send({ error: 'perícia indisponível nesta montagem' });
    const { clienteId } = request.params as { clienteId: string };
    const contratos = await op.perito.contratos(clienteId);
    if (contratos === null) return reply.code(404).send({ error: 'cliente não encontrado' });
    return contratos;
  });

  app.get('/admin/jornada/pericia/:clienteId/planilha', async (request, reply) => {
    if (!op.perito) return reply.code(503).send({ error: 'perícia indisponível nesta montagem' });
    const { clienteId } = request.params as { clienteId: string };
    const gerada = await op.perito.planilha(clienteId);
    if (gerada === null) return reply.code(404).send({ error: 'cliente não encontrado' });
    return reply
      .header('content-type', gerada.mime)
      .header('content-disposition', `attachment; filename="${gerada.nomeArquivo}"`)
      .send(gerada.conteudo);
  });

  // Lote: um arquivo POR CLIENTE (JSON com os conteúdos; a tela dispara os downloads).
  app.get('/admin/jornada/pericia/planilhas', async (_request, reply) => {
    if (!op.perito) return reply.code(503).send({ error: 'perícia indisponível nesta montagem' });
    return { planilhas: await op.perito.planilhasDaFila() };
  });

  // ── JORNADA B (B-R3) — PERITO CONFIRMA os pedidos administrativos ─────────────
  // O ÚNICO fato persistido da Jornada B (homologado). Lei 8: grava o FATO (quem/
  // quando) e agenda a CONSEQUÊNCIA (10 dias) no scheduler EXISTENTE (idempotente
  // por id). As filas derivam do fato + relógio — nunca do timer.
  app.post('/admin/jornada/pericia/:clienteId/confirmar-pedidos', async (request, reply) => {
    if (!op.clientes || !op.pedidosStore) {
      return reply.code(503).send({ error: 'perícia indisponível nesta montagem' });
    }
    const { clienteId } = request.params as { clienteId: string };
    const body = (request.body ?? {}) as { confirmadoPor?: string };

    const cliente = (await op.clientes.list()).find((c) => c.clienteId === clienteId);
    if (!cliente) return reply.code(404).send({ error: 'cliente não encontrado' });
    if (cliente.status === 'AGUARDANDO_10_DIAS' || cliente.status === 'AGUARDANDO_SOCIO') {
      return reply.code(409).send({ error: 'pedidos já confirmados para este cliente' });
    }
    if (cliente.status !== 'PRONTO_AGUARDANDO_PERICIA') {
      return reply.code(409).send({ error: `cliente não está na fila da perícia (status: ${cliente.status})` });
    }

    // Rastreabilidade (Lei 10): snapshot dos bancos/contratos no momento do ato.
    const contratos = op.perito ? await op.perito.contratos(clienteId) : null;
    const now = new Date();
    await op.pedidosStore.save({
      clienteId,
      chatId: cliente.chatId,
      confirmadoEm: now,
      confirmadoPor: body.confirmadoPor?.trim() ? body.confirmadoPor.trim() : 'perito',
      bancos: contratos !== null ? Object.keys(contratos.parse.porBanco) : [],
      contratos: contratos !== null ? contratos.parse.contratos.length : 0,
    });

    // Consequência temporal: sinal para a AHRI quando o prazo vencer (Lei 8).
    await op.scheduler.schedule({
      id: `pedidos-adm:${clienteId}`,
      chatId: cliente.chatId,
      missionId: cliente.missionId,
      kind: 'follow_deadline',
      dueAt: prazoDosPedidos(now),
      note: 'prazo dos pedidos administrativos (10 dias)',
      createdAt: now,
    });

    return { clienteId, confirmado: true, prazoAte: prazoDosPedidos(now).toISOString() };
  });

  // ── JORNADA (R3) — Admin DEFINE A MODALIDADE (VENDA | SOCIEDADE) do cliente ──
  // O último ponto não-derivável do sistema (modelo congelado): 1 marcador por
  // cliente RECONHECIDO. Chat é canal; a modalidade pertence ao cliente.
  app.post('/admin/jornada/clientes/:clienteId/modalidade', async (request, reply) => {
    if (!op.clientes || !op.modalidadeStore) {
      return reply.code(503).send({ error: 'jornada indisponível nesta montagem' });
    }
    const { clienteId } = request.params as { clienteId: string };
    const body = (request.body ?? {}) as { modalidade?: string; decididaPor?: string };
    if (body.modalidade !== 'VENDA' && body.modalidade !== 'SOCIEDADE') {
      return reply.code(400).send({ error: 'modalidade deve ser VENDA ou SOCIEDADE' });
    }
    const cliente = (await op.clientes.list()).find((c) => c.clienteId === clienteId);
    if (!cliente) return reply.code(404).send({ error: 'cliente não encontrado' });
    if (cliente.clienteId === cliente.chatId) {
      return reply.code(409).send({ error: 'contato ainda não reconhecido como cliente' });
    }
    await op.modalidadeStore.save({
      clienteId,
      modalidade: body.modalidade,
      decididaEm: new Date(),
      decididaPor: body.decididaPor?.trim() ? body.decididaPor.trim() : 'admin',
    });
    return { clienteId, modalidade: body.modalidade };
  });

  // ── JORNADA (R3) — Admin VENDE o cliente qualificado (Jornada A completa) ────
  // Guarda: só vende quem está PRONTO_AGUARDANDO_VENDA. Registra a venda e ENCERRA
  // o caso pelo MESMO caminho de /encerrar (CloseMission + drain) — zero fluxo novo.
  app.post('/admin/jornada/clientes/:clienteId/vender', async (request, reply) => {
    if (!op.clientes || !op.vendaStore) {
      return reply.code(503).send({ error: 'jornada indisponível nesta montagem' });
    }
    const { clienteId } = request.params as { clienteId: string };
    const body = (request.body ?? {}) as { comprador?: string; vendidaPor?: string };
    const comprador = body.comprador?.trim() ?? '';
    if (comprador === '') return reply.code(400).send({ error: 'comprador é obrigatório' });

    const cliente = (await op.clientes.list()).find((c) => c.clienteId === clienteId);
    if (!cliente) return reply.code(404).send({ error: 'cliente não encontrado' });
    if (cliente.status === 'VENDIDO') return reply.code(409).send({ error: 'cliente já vendido' });
    if (cliente.status !== 'PRONTO_AGUARDANDO_VENDA') {
      return reply.code(409).send({ error: `cliente não está pronto para venda (status: ${cliente.status})` });
    }

    await op.vendaStore.save({
      clienteId,
      chatId: cliente.chatId,
      comprador,
      vendidaEm: new Date(),
      vendidaPor: body.vendidaPor?.trim() ? body.vendidaPor.trim() : 'admin',
    });

    const executed = await runMissionCommand({
      chatId: cliente.chatId,
      senderId: 'administrador',
      perceptKind: 'closure',
      text: `caso vendido — ${comprador}`,
      useCase: 'CloseMission',
      references: ['encerramento'],
      decisor: 'administrador',
      tipo: 'encerramento',
      fundamento: 'Caso vendido (Jornada A) — Estado Operacional terminal ENCERRADA (DF-11)',
      operationalRuleRef: 'RO-STOP-CONCLUDED-001',
    });
    if (!executed.ok) return reply.code(422).send({ error: executed.error });
    return { clienteId, vendido: true, comprador };
  });

  // ── CLIENTES ────────────────────────────────────────────────────────────────
  // A LISTAGEM por memória (/admin/clients) foi REMOVIDA na R4 (Regra 2 — LEGACY não
  // convive): a lista única é /admin/jornada/clientes (status derivado). O DETALHE
  // do cliente (abaixo) permanece — não foi substituído.
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

    // Comando canônico (Regra 3): mesmo helper de /vender e /reabrir.
    const executed = await runMissionCommand({
      chatId: mission.chatId,
      senderId: 'operador',
      perceptKind: 'closure',
      text: body.reason?.trim() ? body.reason.trim() : 'encerramento operacional',
      useCase: 'CloseMission',
      references: ['encerramento'],
      decisor: 'operador',
      tipo: 'encerramento',
      fundamento: 'Estado Operacional terminal — ENCERRADA (DF-11); RO-R9-001',
      operationalRuleRef: 'RO-STOP-CONCLUDED-001',
    });
    if (!executed.ok) return reply.code(422).send({ error: executed.error });
    return { missionId, closed: true, skipped: executed.skipped, stateId: executed.streamId };
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

    // Comando canônico (Regra 3): mesmo helper de /encerrar e /vender. O drain
    // projeta a reabertura e o Workflow re-arma o acompanhamento (B4.2).
    const executed = await runMissionCommand({
      chatId: mission.chatId,
      senderId: 'operador',
      perceptKind: 'reopening',
      text: body.reason?.trim() ? body.reason.trim() : 'reabertura operacional',
      useCase: 'ReopenMission',
      references: ['reabertura'],
      decisor: 'operador',
      tipo: 'reabertura',
      fundamento: 'Fato jurídico legítimo — retorno ao estado operacional; RO-R9-001',
      operationalRuleRef: 'RO-R9-001',
    });
    if (!executed.ok) return reply.code(422).send({ error: executed.error });
    return { missionId, reopened: true, skipped: executed.skipped, stateId: executed.streamId };
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

  // ── CONEXÃO WHATSAPP (administração de instância Evolution; auth BL-2.1) ──────
  app.get('/admin/whatsapp/status', async (_request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    return op.whatsapp.getStatus();
  });

  app.get('/admin/whatsapp/qr/:instance', async (request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    const { instance } = request.params as { instance: string };
    return op.whatsapp.getQr(instance);
  });

  app.post('/admin/whatsapp/confirm', async (request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    const body = request.body as { instanceName?: string };
    if (!body.instanceName) return reply.code(400).send({ error: 'instanceName obrigatório' });
    return op.whatsapp.confirm(body.instanceName, { role: 'admin' });
  });

  app.get('/admin/whatsapp/apply-instructions', async (_request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    const status = await op.whatsapp.getStatus();
    if (!status.hasPendingApply) return { pending: false, note: 'Nenhuma configuração pendente — a aplicação já usa a instância atual.' };
    return {
      pending: true,
      envToSet: { EVOLUTION_INSTANCE: status.pending?.instance ?? '', WHATSAPP_NUMBER: status.pending?.number ?? '' },
      note: 'Config confirmada e persistida. Para APLICAR: garanta estes valores no /opt/reconstrua/.env e faça o restart controlado (o EVOLUTION_API_KEY é o retornado na criação da instância).',
      command: 'bash /opt/reconstrua/deploy.sh',
    };
  });

  // Operações DESTRUTIVAS → exigem perfil FOUNDER (x-founder-secret) além do Bearer Admin.
  app.post('/admin/whatsapp/instances', async (request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    if (!isFounder(request)) return reply.code(403).send({ error: 'operação exige perfil Founder (x-founder-secret)' });
    const body = request.body as { instanceName?: string };
    const name = (body.instanceName ?? '').trim();
    if (name === '') return reply.code(400).send({ error: 'instanceName obrigatório' });
    return op.whatsapp.createNew(name, { role: 'founder' });
  });

  app.post('/admin/whatsapp/discard', async (request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    if (!isFounder(request)) return reply.code(403).send({ error: 'operação exige perfil Founder (x-founder-secret)' });
    const body = request.body as { instanceName?: string; confirm?: boolean };
    if (!body.instanceName) return reply.code(400).send({ error: 'instanceName obrigatório' });
    if (body.confirm !== true) return reply.code(400).send({ error: 'confirmação explícita obrigatória (confirm:true)' });
    await op.whatsapp.discard(body.instanceName, { role: 'founder' });
    return { discarded: true, instanceName: body.instanceName };
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
