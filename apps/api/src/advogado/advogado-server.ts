// ─────────────────────────────────────────────────────────────────────────────
// buildAdvogadoServer — a API do Portal do Advogado. SÓ Read Models + o registro de
// trabalho jurídico. ISOLAMENTO: toda rota exige `x-advogado-id` de um advogado
// ATIVO e filtra pela atribuição — um advogado JAMAIS vê processos de outro. Sem
// Founder Console, sem financeiro, sem permissões. Toda atividade concluída informa
// a AHRI automaticamente (o Brain decide a comunicação). `.listen` é do dono.
//
// Identificação por header é o transporte provisório até a autenticação da
// Governança (DF-12); o isolamento em si é imposto no runtime (AdvogadoWorkRuntime).
// ─────────────────────────────────────────────────────────────────────────────
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { AssembledAdvogadoOperation } from '@reconstrua/infrastructure';
import { NotAssignedError, type JuridicalEntryKind } from '@reconstrua/application';

const ENTRY_KINDS: readonly JuridicalEntryKind[] = [
  'numero_processo',
  'protocolo',
  'despacho',
  'movimentacao',
  'observacao',
  'prazo',
  'distribuicao',
  'conclusao',
  'documento',
];

function isEntryKind(value: string): value is JuridicalEntryKind {
  return (ENTRY_KINDS as readonly string[]).includes(value);
}

export function buildAdvogadoServer(op: AssembledAdvogadoOperation): FastifyInstance {
  const app = Fastify({ logger: false });

  app.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('access-control-allow-origin', '*');
    reply.header('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
    reply.header('access-control-allow-headers', 'content-type,x-advogado-id');
    done();
  });
  app.options('/*', (_request, reply) => {
    void reply.code(204).send();
  });

  /** Resolve o advogado autenticado (ativo) ou null. */
  async function advogadoOf(request: FastifyRequest): Promise<string | null> {
    const id = request.headers['x-advogado-id'];
    if (typeof id !== 'string' || id.trim() === '') return null;
    const members = await op.staff.list('advogado');
    const member = members.find((m) => m.id === id);
    return member && member.active ? member.id : null;
  }

  // ── ATRIBUIÇÃO (ato do Administrador — consumida pelo Admin Portal) ──────────
  app.post('/advogado-admin/assignments', async (request, reply) => {
    const body = request.body as { missionId?: string; advogadoId?: string; assignedBy?: string };
    if (!body.missionId || !body.advogadoId || !body.assignedBy) {
      return reply.code(400).send({ error: 'missionId, advogadoId e assignedBy são obrigatórios' });
    }
    return op.work.assign(body.missionId, body.advogadoId, body.assignedBy);
  });

  // ── PAINEL ───────────────────────────────────────────────────────────────────
  app.get('/advogado/painel', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    await op.projector.refresh();

    const missions = await op.work.myMissions(advogadoId);
    const pending = await op.work.pending(advogadoId);
    const agenda = await op.work.agenda(advogadoId);
    const entries = await op.work.myEntries(advogadoId);
    const now = new Date();
    const in7d = now.getTime() + 7 * 24 * 60 * 60_000;
    const myMissionIds = new Set(missions.map((m) => m.missionId));
    const newDocuments = op.projector
      .allDocuments()
      .filter((d) => d.missionId !== null && myMissionIds.has(d.missionId)).length;

    return {
      processCount: missions.length,
      pendingCount: pending.length,
      deadlinesSoon: agenda.filter((e) => (e.dueAt?.getTime() ?? 0) <= in7d).length,
      protocolsWaiting: entries.filter((e) => e.kind === 'protocolo' && !e.done).length,
      newDocuments,
      queue: (await op.handoff.openFor('advogado')).length,
      alerts: agenda.filter((e) => (e.dueAt?.getTime() ?? Infinity) < now.getTime()).map((e) => `prazo vencido: ${e.text}`),
    };
  });

  // ── MEUS PROCESSOS ───────────────────────────────────────────────────────────
  app.get('/advogado/processos', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    await op.projector.refresh();
    const assignments = await op.work.myMissions(advogadoId);
    const summaries = op.projector.missions();
    return assignments.map((a) => ({
      assignment: a,
      summary: summaries.find((m) => m.missionId === a.missionId) ?? null,
    }));
  });

  app.get('/advogado/processos/:missionId', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    const { missionId } = request.params as { missionId: string };
    // ISOLAMENTO: 403 se o processo não é dele.
    if (!(await op.work.isAssigned(advogadoId, missionId))) {
      return reply.code(403).send({ error: 'processo não atribuído a este advogado' });
    }
    await op.projector.refresh();
    return {
      missionId,
      timeline: op.projector.missionTimeline(missionId),
      progress: await op.workflow.progress(missionId),
      documents: op.projector.allDocuments().filter((d) => d.missionId === missionId),
      pericias: op.projector.allPericias().filter((p) => p.missionId === missionId),
      juridical: await op.work.missionEntries(advogadoId, missionId),
    };
  });

  // ── ATIVIDADES (informam a AHRI automaticamente) ─────────────────────────────
  app.post('/advogado/processos/:missionId/atividades', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    const { missionId } = request.params as { missionId: string };
    const body = request.body as { kind?: string; text?: string; dueAt?: string; attachmentRef?: string };
    if (!body.kind || !isEntryKind(body.kind) || !body.text) {
      return reply.code(400).send({ error: 'kind válido e text são obrigatórios' });
    }
    try {
      const entry = await op.work.addEntry({
        advogadoId,
        missionId,
        kind: body.kind,
        text: body.text,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        attachmentRef: body.attachmentRef ?? null,
      });
      // A AHRI é SEMPRE informada; o Executive Brain decide a comunicação.
      const ahri = await op.bridge.notify(entry);
      return { entry, ahri };
    } catch (error) {
      if (error instanceof NotAssignedError) return reply.code(403).send({ error: error.message });
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'falha' });
    }
  });

  app.patch('/advogado/atividades/:entryId/concluir', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    const { entryId } = request.params as { entryId: string };
    try {
      return await op.work.markDone(advogadoId, entryId);
    } catch {
      return reply.code(403).send({ error: 'atividade não pertence a este advogado' });
    }
  });

  // ── LISTAS (todas isoladas por advogado) ─────────────────────────────────────
  const listRoute = (path: string, kind: JuridicalEntryKind | null): void => {
    app.get(path, async (request, reply) => {
      const advogadoId = await advogadoOf(request);
      if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
      return kind === null ? op.work.myEntries(advogadoId) : op.work.myEntries(advogadoId, kind);
    });
  };
  listRoute('/advogado/historico', null);
  listRoute('/advogado/protocolos', 'protocolo');
  listRoute('/advogado/movimentacoes', 'movimentacao');
  listRoute('/advogado/arquivos', 'documento');

  app.get('/advogado/pendencias', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    return op.work.pending(advogadoId);
  });

  app.get('/advogado/agenda', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    return op.work.agenda(advogadoId);
  });

  app.get('/advogado/documentos', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    await op.projector.refresh();
    const myMissionIds = new Set((await op.work.myMissions(advogadoId)).map((m) => m.missionId));
    return op.projector.allDocuments().filter((d) => d.missionId !== null && myMissionIds.has(d.missionId));
  });

  app.get('/advogado/perfil', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    const members = await op.staff.list('advogado');
    return members.find((m) => m.id === advogadoId) ?? null;
  });

  return app;
}
