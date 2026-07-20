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
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { AssembledAdvogadoOperation } from '@reconstrua/infrastructure';
import { NotAssignedError, type JuridicalEntryKind } from '@reconstrua/application';
import { requireBearer } from '../auth/bearer-guard.js';

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

export function buildAdvogadoServer(op: AssembledAdvogadoOperation, opts: { readonly accessSecret?: string } = {}): FastifyInstance {
  const app = Fastify({ logger: false });

  app.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('access-control-allow-origin', '*');
    reply.header('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
    reply.header('access-control-allow-headers', 'content-type,x-advogado-id,authorization');
    done();
  });
  app.options('/*', (_request, reply) => {
    void reply.code(204).send();
  });

  // BL-3.1 — Autenticação Real (DF-12): toda rota /advogado* exige o segredo do
  // Advogado (Bearer). REUSA o guard do BL-2.1 (sem auth paralela, sem duplicação).
  // O isolamento por atribuição (x-advogado-id + isAssigned) permanece INTOCADO,
  // agora atrás da autenticação real. Multiescritório: o segredo pode ser por escritório.
  requireBearer(app, { secret: opts.accessSecret ?? '', protect: (path) => path.startsWith('/advogado') });

  /** Resolve o advogado autenticado (ativo) ou null. */
  async function advogadoOf(request: FastifyRequest): Promise<string | null> {
    const id = request.headers['x-advogado-id'];
    if (typeof id !== 'string' || id.trim() === '') return null;
    const members = await op.staff.list('advogado');
    const member = members.find((m) => m.id === id);
    return member && member.active ? member.id : null;
  }

  // ── GO-LIVE-04 · AUTENTICAÇÃO INDIVIDUAL (Auth Runtime compartilhado) ────────
  // Convite (ato do Admin) → criar senha (advogado, via convite) → login (ID +
  // senha própria). Tudo atrás do Bearer de transporte (só os servidores dos
  // portais o possuem — o browser jamais). Fail-closed: sem runtime ⇒ 503.

  // ATO DO ADMINISTRADOR: emite o convite de um advogado ativo (nunca público).
  app.post('/advogado-admin/convite', async (request, reply) => {
    if (!op.auth) return reply.code(503).send({ error: 'autenticação indisponível' });
    const body = request.body as { advogadoId?: string };
    if (!body.advogadoId) return reply.code(400).send({ error: 'advogadoId obrigatório' });
    const token = await op.auth.emitirConvite(body.advogadoId, new Date());
    if (token === null) return reply.code(404).send({ error: 'advogado não encontrado ou inativo' });
    return { advogadoId: body.advogadoId, token, validadeDias: 7 };
  });

  // O ADVOGADO cria a própria senha a partir do convite (nunca pela URL crua).
  app.post('/advogado-auth/definir-senha', async (request, reply) => {
    if (!op.auth) return reply.code(503).send({ error: 'autenticação indisponível' });
    const body = request.body as { token?: string; senha?: string };
    if (!body.token || !body.senha) return reply.code(400).send({ error: 'token e senha são obrigatórios' });
    const result = await op.auth.definirSenha(body.token, body.senha, new Date());
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true, advogadoId: result.advogadoId, nome: result.nome };
  });

  // LOGIN individual: ID + senha própria. Erro único (nunca vaza qual fator falhou).
  app.post('/advogado-auth/login', async (request, reply) => {
    if (!op.auth) return reply.code(503).send({ error: 'autenticação indisponível' });
    const body = request.body as { advogadoId?: string; senha?: string };
    if (!body.advogadoId || !body.senha) return reply.code(400).send({ error: 'advogadoId e senha são obrigatórios' });
    const result = await op.auth.login(body.advogadoId, body.senha);
    if (!result.ok) return reply.code(401).send({ error: result.error });
    return { ok: true, advogadoId: result.advogadoId, nome: result.nome };
  });

  // ── ATRIBUIÇÃO (ato do Administrador — consumida pelo Admin Portal) ──────────
  app.post('/advogado-admin/assignments', async (request, reply) => {
    const body = request.body as { missionId?: string; advogadoId?: string; assignedBy?: string };
    if (!body.missionId || !body.advogadoId || !body.assignedBy) {
      return reply.code(400).send({ error: 'missionId, advogadoId e assignedBy são obrigatórios' });
    }
    return op.work.assign(body.missionId, body.advogadoId, body.assignedBy);
  });

  // ── GO-LIVE 15C (Workflow 2) — SOLICITAÇÕES COMPLEMENTARES ───────────────────
  // O advogado ADMINISTRA a entidade (criar/listar/cancelar/reabrir); a AHRI
  // apenas executa. caseId é a identidade funcional (Decisão 5). O disparo da
  // mensagem ao cliente é do 15C-3 (a criação registra a necessidade).
  app.post('/advogado/casos/:caseId/document-requests', async (request, reply) => {
    if (!op.documentRequests) return reply.code(503).send({ error: 'document requests indisponível nesta montagem' });
    const { caseId } = request.params as { caseId: string };
    const body = request.body as {
      documentName?: string; optionalMessage?: string; clientId?: string; advogadoId?: string;
      requestedBy?: string; priority?: 'normal' | 'alta'; dueAt?: string;
      reminderPolicy?: 'nenhum' | '24h' | '48h' | '72h' | 'semanal';
    };
    if (!body.documentName?.trim()) return reply.code(400).send({ error: 'documentName é obrigatório' });
    if (!body.clientId?.trim()) return reply.code(400).send({ error: 'clientId é obrigatório (canal do cliente)' });
    if (!body.advogadoId?.trim()) return reply.code(400).send({ error: 'advogadoId é obrigatório' });

    const criado = await op.documentRequests.criar({
      requestId: randomUUID(),
      caseId,
      clientId: body.clientId,
      lawyerId: body.advogadoId,
      documentName: body.documentName,
      ...(body.optionalMessage !== undefined ? { optionalMessage: body.optionalMessage } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.reminderPolicy !== undefined ? { reminderPolicy: body.reminderPolicy } : {}),
      ...(body.dueAt !== undefined ? { dueAt: new Date(body.dueAt) } : {}),
      requestedBy: body.requestedBy?.trim() ? body.requestedBy : body.advogadoId,
      createdAt: new Date(),
    });
    if (criado.isErr()) return reply.code(400).send({ error: criado.unwrapErr().message });
    // 15C-3 · Parte 3 — DISPARO PROATIVO: a AHRI anuncia ao cliente (best-effort;
    // a criação já está persistida — falha de envio nunca desfaz a solicitação).
    const estado = criado.unwrap();
    const anuncio = op.documentRequestComunicador ? await op.documentRequestComunicador.anunciar(estado) : { ok: false, erro: 'comunicador indisponível nesta montagem' };
    return reply.code(201).send({ ...estado, anuncio });
  });

  app.get('/advogado/casos/:caseId/document-requests', async (request, reply) => {
    if (!op.documentRequestStore) return reply.code(503).send({ error: 'document requests indisponível nesta montagem' });
    const { caseId } = request.params as { caseId: string };
    return { solicitacoes: await op.documentRequestStore.doCaso(caseId) };
  });

  // 15C-2 — a LISTA do painel (todas as solicitações do advogado autenticado).
  app.get('/advogado/document-requests', async (request, reply) => {
    if (!op.documentRequestStore) return reply.code(503).send({ error: 'document requests indisponível nesta montagem' });
    const advogadoId = (request.headers['x-advogado-id'] as string | undefined)?.trim() ?? '';
    if (advogadoId === '') return reply.code(400).send({ error: 'x-advogado-id é obrigatório' });
    return { solicitacoes: await op.documentRequestStore.doAdvogado(advogadoId) };
  });

  // 15C-2 — o DETALHE de uma solicitação (cabeçalho + history completo).
  app.get('/advogado/document-requests/:id', async (request, reply) => {
    if (!op.documentRequestStore) return reply.code(503).send({ error: 'document requests indisponível nesta montagem' });
    const { id } = request.params as { id: string };
    const solicitacao = await op.documentRequestStore.porId(id);
    if (solicitacao === null) return reply.code(404).send({ error: 'solicitação não encontrada' });
    return solicitacao;
  });

  app.post('/advogado/document-requests/:id/cancelar', async (request, reply) => {
    if (!op.documentRequests) return reply.code(503).send({ error: 'document requests indisponível nesta montagem' });
    const { id } = request.params as { id: string };
    const body = request.body as { motivo?: string; advogadoId?: string };
    if (!body.advogadoId?.trim()) return reply.code(400).send({ error: 'advogadoId é obrigatório' });
    const r = await op.documentRequests.cancelar(id, body.motivo?.trim() ? body.motivo : 'cancelada pelo advogado', body.advogadoId, new Date());
    if (r.isErr()) return reply.code(409).send({ error: r.unwrapErr().message });
    return r.unwrap();
  });

  app.post('/advogado/document-requests/:id/reabrir', async (request, reply) => {
    if (!op.documentRequests) return reply.code(503).send({ error: 'document requests indisponível nesta montagem' });
    const { id } = request.params as { id: string };
    const body = request.body as { motivo?: string; advogadoId?: string };
    if (!body.advogadoId?.trim()) return reply.code(400).send({ error: 'advogadoId é obrigatório' });
    const r = await op.documentRequests.reabrir(id, body.motivo?.trim() ? body.motivo : 'documento incorreto', body.advogadoId, new Date());
    if (r.isErr()) return reply.code(409).send({ error: r.unwrapErr().message });
    return r.unwrap();
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
      const registrada = await op.work.addEntry({
        advogadoId,
        missionId,
        kind: body.kind,
        text: body.text,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        attachmentRef: body.attachmentRef ?? null,
      });
      // GO-LIVE-02: a versão HUMANIZADA nasce NA ESCRITA (best-effort; falha ⇒
      // pendente e o tick reprocessa — o cliente nunca vê texto jurídico cru).
      const entry = op.traducao !== undefined ? await op.traducao.traduzir(registrada) : registrada;
      // A AHRI é SEMPRE informada; o Executive Brain decide a comunicação.
      // B-R5: o chatOf do bridge lê projector.missions() (síncrono) — refresh ANTES
      // garante a resolução da conversa mesmo com projector frio (processo recém-
      // iniciado). Sem isto, a notificação falharia em silêncio (chatId null).
      await op.projector.refresh();
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

  // ── BL-3.3 — CONTEÚDO REAL do documento, ISOLADO POR ATRIBUIÇÃO ───────────────
  // Reutiliza o DocumentContentService (CAT-02C, mesma instância do admin). Valida
  // OBRIGATORIAMENTE que o processo é do advogado (isAssigned) e que o documento
  // pertence a esse processo. Sem parser novo, sem rota paralela, sem alterar
  // autenticação, persistência, regras jurídicas nem o isolamento.
  app.get('/advogado/processos/:missionId/documentos/:documentId/content', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    const { missionId, documentId } = request.params as { missionId: string; documentId: string };
    if (!(await op.work.isAssigned(advogadoId, missionId))) {
      return reply.code(403).send({ error: 'processo não atribuído a este advogado' });
    }
    await op.projector.refresh();
    const belongs = op.projector.allDocuments().some((d) => d.documentId === documentId && d.missionId === missionId);
    if (!belongs) return reply.code(404).send({ error: 'documento não pertence a este processo' });
    const content = op.documentContent ? await op.documentContent.byDocumentId(documentId) : null;
    if (content === null) return reply.code(404).send({ error: 'documento sem conteúdo disponível' });
    return reply.header('content-type', content.mime).send(Buffer.from(content.bytes));
  });

  app.get('/advogado/perfil', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    const members = await op.staff.list('advogado');
    return members.find((m) => m.id === advogadoId) ?? null;
  });

  return app;
}
