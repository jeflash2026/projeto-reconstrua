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
import {
  CATALOGO_CONSIGNADO_INSS,
  ESTRATEGIAS_CONSIGNADO_INSS,
  agregarConhecimento,
  aprenderDaConversa,
  computeOperationalMetrics,
  gerarBriefing,
  hipotesesDoDossie,
  indicadoresExecutivos,
  montarBibliotecaEstrategias,
  montarDossie,
  montarPainelDoArquiteto,
  montarTimelineCognitiva,
  ordenarCasos,
  prazoDosPedidos,
  resumirCaso,
  type DossieJuridico,
  type ConversationContextView,
  type FatoAprendidoDeCliente,
  type HipoteseView,
  type StaffRole,
} from '@reconstrua/application';
import { requireBearer, secretsMatch } from '../auth/bearer-guard.js';

const STAFF_ROLES: readonly StaffRole[] = [
  'advogado',
  'perito',
  'operador',
  'supervisor',
  'administrador',
];

function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

/** A fatia do Dossiê Pericial que o Admin consome (Decreto 2026-07-21). */
interface DossiePericialResumo {
  readonly totalContratos: number;
  readonly porBanco: ReadonlyArray<{
    readonly bancoNome: string;
    readonly bancoCodigo: string | null;
    readonly contratos: ReadonlyArray<{ readonly contrato: string }>;
  }>;
  readonly migrados: ReadonlyArray<{ readonly contrato: string }>;
  readonly filaPedidoAdministrativo: ReadonlyArray<{ readonly contrato: string }>;
  readonly indicios: ReadonlyArray<{
    readonly estrategiaRef: string;
    readonly titulo: string;
    readonly fundamentoFactual: string;
    readonly contratos: ReadonlyArray<string>;
  }>;
}

export function buildAdminServer(
  op: AssembledAdminOperation,
  opts: {
    readonly accessSecret?: string;
    readonly founderSecret?: string;
    readonly founderName?: string;
    /** Decreto Dossiê Pericial (2026-07-21): visão do PERITO — HISCON parseado
     *  (contratos por banco, migrados, indícios). Opcional: ausente ⇒ 404. */
    readonly pericia?: {
      dossie(chatId: string): Promise<DossiePericialResumo | null>;
      migradosDeTodos(): Promise<unknown>;
      /** documentId → rótulo humano ("RG (frente)", "HISCON"…) da contabilidade. */
      rotulosDosDocumentos?(chatId: string): Promise<Record<string, string>>;
      /** Total REAL de documentos registrados (fonte do painel). */
      contagemDocumentosRegistrados?(): Promise<number>;
      /** Medidor de Custo: documentId → chatId (dono de cada leitura). */
      mapaDocumentoParaChat?(): Promise<Record<string, string>>;
      /** Decreto 2026-07-21 (Financeiro): potencial de recuperação (o JÁ
       *  descontado até hoje) por cliente + total. */
      potencialDeTodos?(): Promise<{
        total: number;
        porCliente: ReadonlyArray<{
          readonly chatId: string;
          readonly nomeCliente: string | null;
          readonly valor: number;
          readonly contratos: number;
          readonly contratosSemValor: number;
        }>;
      }>;
    };
    /** Medidor de Custo (2026-07-21): registros de gasto de IA (conversa +
     *  leitura de documentos) para o painel "Custos de IA". */
    readonly custos?: {
      listar(): Promise<
        ReadonlyArray<{
          readonly at: string;
          readonly contexto: 'conversa' | 'leitura-documento';
          readonly provider: string;
          readonly model: string;
          readonly chatId: string | null;
          readonly documentId: string | null;
          readonly tokensIn: number | null;
          readonly tokensOut: number | null;
          readonly custoUsd: number | null;
        }>
      >;
    };
    /** Decreto 2026-07-22: REAQUECIMENTO de leads frios — o admin AUTORIZA
     *  lead a lead; a AHRI envia a mensagem do estágio (guardrails no serviço). */
    readonly reaquecimento?: {
      leadsFrios(): Promise<readonly unknown[]>;
      reaquecer(
        chatId: string,
      ): Promise<{ ok: true; estagio: string } | { ok: false; error: string }>;
    };
    /** Decreto 2026-07-21: convite→senha própria→login do PERITO (sem senha
     *  compartilhada). O Admin emite o convite; o portal do perito autentica. */
    readonly peritoAuth?: {
      emitirConvite(peritoId: string, now: Date): Promise<string | null>;
      definirSenha(
        token: string,
        senha: string,
        now: Date,
      ): Promise<{ ok: true; advogadoId: string; nome: string } | { ok: false; error: string }>;
      login(
        peritoId: string,
        senha: string,
      ): Promise<{ ok: true; advogadoId: string; nome: string } | { ok: false; error: string }>;
    };
  } = {},
): FastifyInstance {
  const app = Fastify({ logger: false });

  // Gate FOUNDER (Super Admin) para operações DESTRUTIVAS de WhatsApp (criar/descartar
  // instância). Além da auth BL-2.1 (Bearer do Admin), exige o header `x-founder-secret`
  // = FOUNDER_ACCESS_SECRET, comparado em tempo constante. Fail-closed: segredo vazio ⇒ nega.
  const founderSecret = opts.founderSecret ?? '';
  const isFounder = (request: { headers: Record<string, unknown> }): boolean => {
    const presented = request.headers['x-founder-secret'];
    return (
      founderSecret !== '' &&
      typeof presented === 'string' &&
      secretsMatch(presented, founderSecret)
    );
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
  requireBearer(app, {
    secret: opts.accessSecret ?? '',
    protect: (path) => path.startsWith('/admin/'),
  });

  // ── DASHBOARD ────────────────────────────────────────────────────────────────
  app.get('/admin/dashboard', async () => {
    await op.projector.refresh();
    const now = new Date();
    const metrics = await op.metricsStore.load();
    const memories = await op.memoryStore.all();
    const today = now.toISOString().slice(0, 10);

    const awaitingDocuments = memories.filter((m) => m.documentsPending.length > 0).length;
    const newToday = memories.filter(
      (m) => (m.firstContactAt?.toISOString().slice(0, 10) ?? '') === today,
    ).length;
    const totalMessages = memories.reduce((sum, m) => sum + m.messageCount, 0);
    const stats = op.observability.stats();
    const bottlenecks = await op.admin.answer('bottlenecks', now);
    const sector = await op.admin.answer('sector_needing_attention', now);

    // 100% DADOS REAIS (decreto 2026-07-21): clientes/casos vêm da LISTA ÚNICA
    // derivada (nunca de eventos re-contados — reenvios e replays inflavam o
    // painel); documentos vêm da CONTABILIDADE documental. Métricas projetadas
    // ficam como fallback quando a fonte derivada não está montada.
    const listaClientes = op.clientes ? await op.clientes.list(now) : null;
    const documentosReais = opts.pericia?.contagemDocumentosRegistrados
      ? await opts.pericia.contagemDocumentosRegistrados().catch(() => null)
      : null;

    return {
      activeClients: listaClientes !== null ? listaClientes.length : (metrics?.clientCount ?? 0),
      newClientsToday: newToday,
      awaitingDocuments,
      awaitingPericia: (await op.handoff.openFor('perito')).length,
      awaitingAdvogado: (await op.handoff.openFor('advogado')).length,
      processesDistributed:
        listaClientes !== null
          ? listaClientes.filter((c) => c.status === 'EM_PROCESSO').length
          : (metrics?.processCount ?? 0),
      avgHandlingMs: stats.avgLatencyMs,
      messageCount: totalMessages,
      documentCount: documentosReais ?? metrics?.documentCount ?? 0,
      financialUnderAdministration: metrics?.financialUnderAdministration ?? null,
      expectedFees: null, // sem fonte de dados no domínio congelado — nunca inventado
      bottlenecks: bottlenecks.fact,
      alerts: sector.fact,
      health: op.health.all(),
      overall: op.health.overall(),
    };
  });

  // ── AHRI COMMAND CENTER (GO-LIVE 13A) — o briefing executivo dinâmico + os
  //    indicadores de negócio. Ambos DERIVADOS dos Read Models pela camada de
  //    aplicação (command-center); a API só monta as entradas e serve. A interface
  //    apenas renderiza. Nada é recalculado fora dos Read Models.
  app.get('/admin/command-center', async () => {
    await op.projector.refresh();
    const now = new Date();
    const metrics = await op.metricsStore.load();
    const memories = await op.memoryStore.all();
    const today = now.toISOString().slice(0, 10);

    const aguardandoDocumentos = memories.filter((m) => m.documentsPending.length > 0).length;
    const novosClientesHoje = memories.filter(
      (m) => (m.firstContactAt?.toISOString().slice(0, 10) ?? '') === today,
    ).length;
    const aguardandoAdvogado = (await op.handoff.openFor('advogado')).length;
    const bottlenecks = await op.admin.answer('bottlenecks', now);
    const casosPorAdvogado = metrics?.perAdvogado ?? {};

    // GO-LIVE 13A — INSIGHTS COGNITIVOS: derivados EXCLUSIVAMENTE dos Read Models
    // do feedback (11C/11D) via o painel do arquiteto. Sem o store, ficam nulos
    // (o briefing simplesmente não os mostra) — nunca inventados.
    const atendimentos = op.atendimentoStore ? await op.atendimentoStore.listar() : [];
    const painel = montarPainelDoArquiteto(ESTRATEGIAS_CONSIGNADO_INSS, atendimentos);
    const temFeedback = atendimentos.length > 0;
    const topEstrategia = painel.estrategiasMaisUtilizadas[0] ?? null;

    // 100% dados reais (decreto): a lista única derivada é a fonte dos clientes.
    const listaCC = op.clientes ? await op.clientes.list(now) : null;
    const briefing = gerarBriefing({
      founderName: opts.founderName ?? 'founder',
      now,
      clientesAtivos: listaCC !== null ? listaCC.length : (metrics?.clientCount ?? 0),
      novosClientesHoje,
      dossiesProntos: 0, // Read Model de "dossiê pronto/liberado" chega em incremento próprio
      aguardandoDocumentos,
      aguardandoAdvogado,
      casosCriticos: 0, // sem Read Model de criticidade dedicado — nunca inventado
      casosPorAdvogado,
      limiteCargaAdvogado: 10,
      confiancaMediaCatalogo: temFeedback ? painel.confiancaMedia : null,
      confiancaMediaAnterior: null, // sem baseline histórico persistido — não força delta
      taxaAcerto: temFeedback ? painel.taxaAcerto : null,
      estrategiaEmAlta: topEstrategia
        ? { ref: topEstrategia.chave, usos: topEstrategia.ocorrencias }
        : null,
      gargalo: bottlenecks.available ? bottlenecks.fact : null,
    });

    // Decreto 2026-07-21: "Valor potencial recuperável" = o JÁ descontado até
    // hoje nos HISCONs (mesma fonte da aba Financeiro) — nunca métrica projetada.
    const potencialCC = opts.pericia?.potencialDeTodos
      ? await opts.pericia.potencialDeTodos().catch(() => null)
      : null;
    // 100% dados reais TAMBÉM na Visão Executiva (correção do "2 clientes /
    // 10 documentos" com uma única Isabel): clientes e casos vêm da LISTA ÚNICA
    // derivada; documentos vêm da CONTABILIDADE documental; dossiês contam
    // clientes com HISCON legível (o dossiê pericial existe para eles). As
    // métricas projetadas ficam apenas como fallback de montagem incompleta.
    const documentosReaisCC = opts.pericia?.contagemDocumentosRegistrados
      ? await opts.pericia.contagemDocumentosRegistrados().catch(() => null)
      : null;

    const indicadores = indicadoresExecutivos({
      clientesAtivos: listaCC !== null ? listaCC.length : (metrics?.clientCount ?? 0),
      novosClientesHoje,
      dossiesGerados:
        potencialCC !== null ? potencialCC.porCliente.length : painel.totalAtendimentos,
      casosDistribuidos:
        listaCC !== null
          ? listaCC.filter((c) => c.status === 'EM_PROCESSO').length
          : (metrics?.processCount ?? 0),
      aguardandoDocumentos,
      casosCriticos: 0,
      tempoMedioAteDecisaoMs: temFeedback ? painel.tempoMedioAteDecisaoMs : null,
      precisaoDecisoes: temFeedback ? painel.taxaAcerto : null,
      confiancaMediaIA: temFeedback ? painel.confiancaMedia : null,
      documentosProcessados: documentosReaisCC ?? metrics?.documentCount ?? 0,
      valorRecuperavel:
        potencialCC !== null && potencialCC.porCliente.length > 0
          ? potencialCC.total
          : (metrics?.financialUnderAdministration ?? null),
      receitaPrevista: null,
    });

    return { briefing, indicadores };
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
      return reply
        .code(409)
        .send({ error: `cliente não está na fila da perícia (status: ${cliente.status})` });
    }

    // Rastreabilidade (Lei 10): snapshot dos bancos/contratos no momento do ato.
    const contratos = op.perito ? await op.perito.contratos(clienteId) : null;
    const now = new Date();
    await op.pedidosStore.save({
      clienteId,
      chatId: cliente.chatId,
      confirmadoEm: now,
      confirmadoPor: body.confirmadoPor?.trim() ? body.confirmadoPor.trim() : 'perito',
      // Snapshot do parser DETALHADO quando ele reconheceu o formato em blocos
      // (o heurístico devolvia 0 no HISCON real); fallback preservado.
      bancos:
        contratos !== null && (contratos.detalhado?.contratos.length ?? 0) > 0
          ? [
              ...new Set(
                contratos.detalhado.contratos.map((c) => c.bancoNome ?? 'BANCO NÃO IDENTIFICADO'),
              ),
            ]
          : contratos !== null
            ? Object.keys(contratos.parse.porBanco)
            : [],
      contratos:
        contratos !== null && (contratos.detalhado?.contratos.length ?? 0) > 0
          ? contratos.detalhado.contratos.length
          : contratos !== null
            ? contratos.parse.contratos.length
            : 0,
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
      return reply
        .code(409)
        .send({ error: `cliente não está pronto para venda (status: ${cliente.status})` });
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
  // Decreto Dossiê Pericial: rótulos HUMANOS dos documentos ("RG (frente)",
  // "HISCON") no lugar de "documento 094d7a2b" — direto da contabilidade.
  async function rotulosDe(chatId: string): Promise<Record<string, string>> {
    if (!opts.pericia?.rotulosDosDocumentos) return {};
    try {
      return await opts.pericia.rotulosDosDocumentos(chatId);
    } catch {
      return {};
    }
  }
  function aplicarRotuloEmTexto(texto: string, rotulos: Record<string, string>): string {
    return texto.replace(/documento ([0-9a-f]{8})/gi, (original, id8: string) => {
      const completo = Object.keys(rotulos).find((k) => k.startsWith(id8));
      return completo !== undefined ? (rotulos[completo] ?? original) : original;
    });
  }
  type MemoriaDoCliente = NonNullable<Awaited<ReturnType<typeof op.memoryStore.load>>>;
  function memoriaComRotulos(
    memory: MemoriaDoCliente,
    rotulos: Record<string, string>,
  ): MemoriaDoCliente {
    return {
      ...memory,
      documentsSent: memory.documentsSent.map((d) => ({ ...d, label: rotulos[d.ref] ?? d.label })),
      rememberedEvents: memory.rememberedEvents.map((e) => ({
        ...e,
        description: aplicarRotuloEmTexto(e.description, rotulos),
      })),
    };
  }

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
    return {
      memory: memoriaComRotulos(memory, await rotulosDe(chatId)),
      relationship,
      conversation,
      missions,
    };
  });

  // ── DOSSIÊ JURÍDICO (GO-LIVE 13A · seção 4) — o parecer inicial da AHRI para um
  //    cliente. Montado pela camada de aplicação (montarDossie) a partir dos Read
  //    Models (memória viva, conversa, missões) + o motor de raciocínio que a AHRI
  //    já possui. O conhecimento é RE-DERIVADO da conversa pela MESMA função do
  //    pipeline (aprenderDaConversa) — nenhuma arquitetura nova, nada recalculado
  //    na interface, nada inventado. Helper reutilizado pela timeline e pelos casos.
  async function dossieDoCliente(chatId: string): Promise<DossieJuridico | null> {
    const cru = await op.memoryStore.load(chatId);
    if (!cru) return null;
    const memory = memoriaComRotulos(cru, await rotulosDe(chatId));
    const now = new Date();
    const entries = await op.conversationStore.recent(chatId, 200);
    const ultimoInbound = [...entries]
      .reverse()
      .find((e) => e.kind === 'inbound' && e.text !== null && e.text !== '');
    const context = {
      chatId,
      session: { chatId, turns: entries.length, lastInboundAt: null, lastOutboundAt: null },
      recentEntries: entries,
      recentOutboundTexts: entries
        .filter((e) => e.kind === 'outbound' && e.text !== null)
        .map((e) => e.text ?? ''),
      lastPercept: ultimoInbound
        ? {
            envelope: { text: ultimoInbound.text },
            enrichment: { perceivedPurpose: 'service_request', detectedIntentSignal: null },
          }
        : null,
      silenceMs: null,
    } as unknown as ConversationContextView;
    const conhecimento = aprenderDaConversa(context, CATALOGO_CONSIGNADO_INSS);
    const documentosReconhecidos = memory.documentsSent.map((d) => d.label);
    const contratosEncontrados = documentosReconhecidos.filter((d) => /contrato/i.test(d));
    const timeline = memory.rememberedEvents.map((e) => ({
      rotulo: e.description,
      em: e.source.at,
      fonte: `read-model:memory:${e.source.kind}`,
    }));
    const missionId = op.projector.missionsOf(chatId)[0] ?? null;
    const dossie = montarDossie({
      clienteId: chatId,
      chatId,
      missionId,
      decisionId: null,
      correlationId: null,
      versaoCatalogo: '11A',
      geradoEm: now,
      entradas: { conhecimento, documentosRecebidos: documentosReconhecidos },
      documentosReconhecidos,
      contratosEncontrados,
      timeline,
    });

    // Decreto Dossiê Pericial: o parecer é ENRIQUECIDO pelos FATOS do HISCON
    // parseado — contratos encontrados, evidências e hipóteses nascem do
    // documento (cada item cita o fato; nada é inventado pela IA).
    const pericial = opts.pericia ? await opts.pericia.dossie(chatId).catch(() => null) : null;
    if (pericial === null || pericial.totalContratos === 0) return dossie;

    const contratosDoHiscon = pericial.porBanco.flatMap((b) =>
      b.contratos.map(
        (c) =>
          `${c.contrato} — ${b.bancoNome}${b.bancoCodigo !== null ? ` (${b.bancoCodigo})` : ''}`,
      ),
    );
    const evidenciasDoHiscon = pericial.indicios.map(
      (i) => `${i.fundamentoFactual} [HISCON · ${i.estrategiaRef}]`,
    );
    const hipotesesDoHiscon = pericial.indicios.map((i, posicao) => ({
      posicao: posicao + 1,
      ref: i.estrategiaRef,
      hipotese: i.titulo,
      confianca: 'media' as const,
      prioridade: posicao + 1,
      justificativa: i.fundamentoFactual,
      fundamento: 'HISCON — fatos extraídos do documento (parser determinístico)',
    }));
    const acoes: string[] = [];
    if (pericial.filaPedidoAdministrativo.length > 0) {
      acoes.push(
        `Perito: fazer os pedidos administrativos de ${String(pericial.filaPedidoAdministrativo.length)} contrato(s) em ${String(pericial.porBanco.length)} banco(s)`,
      );
    }
    if (pericial.migrados.length > 0) {
      acoes.push(
        `Admin: ${String(pericial.migrados.length)} contrato(s) MIGRADO(s) sem pedido administrativo — destinar diretamente a um advogado`,
      );
    }

    return {
      ...dossie,
      contratosEncontrados: contratosDoHiscon,
      evidenciasEncontradas: [...dossie.evidenciasEncontradas, ...evidenciasDoHiscon],
      hipoteses: dossie.hipoteses.length > 0 ? dossie.hipoteses : hipotesesDoHiscon,
      proximasAcoes: [...dossie.proximasAcoes, ...acoes],
      resumoExecutivo:
        dossie.hipoteses.length > 0
          ? dossie.resumoExecutivo
          : `HISCON analisado: ${String(pericial.totalContratos)} contrato(s) em ${String(pericial.porBanco.length)} banco(s); ${String(pericial.indicios.length)} indício(s) de estratégia identificados a partir dos fatos do documento.`,
    };
  }

  // ── AUTENTICAÇÃO DO PERITO (Decreto 2026-07-21) — convite do Admin → o perito
  //    cria a PRÓPRIA senha → login individual. Mesmo Auth Runtime do advogado
  //    (papel 'perito'); rotas atrás do Bearer do Admin (só os portais o têm).
  app.post('/admin/perito/convite', async (request, reply) => {
    if (!opts.peritoAuth)
      return reply.code(503).send({ error: 'autenticação do perito indisponível' });
    const body = request.body as { peritoId?: string };
    if (!body.peritoId) return reply.code(400).send({ error: 'peritoId obrigatório' });
    const token = await opts.peritoAuth.emitirConvite(body.peritoId, new Date());
    if (token === null) return reply.code(404).send({ error: 'perito não encontrado ou inativo' });
    return { peritoId: body.peritoId, token, validadeDias: 7 };
  });

  app.post('/admin/perito/definir-senha', async (request, reply) => {
    if (!opts.peritoAuth)
      return reply.code(503).send({ error: 'autenticação do perito indisponível' });
    const body = request.body as { token?: string; senha?: string };
    if (!body.token || !body.senha)
      return reply.code(400).send({ error: 'token e senha são obrigatórios' });
    const result = await opts.peritoAuth.definirSenha(body.token, body.senha, new Date());
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true, peritoId: result.advogadoId, nome: result.nome };
  });

  app.post('/admin/perito/login', async (request, reply) => {
    if (!opts.peritoAuth)
      return reply.code(503).send({ error: 'autenticação do perito indisponível' });
    const body = request.body as { peritoId?: string; senha?: string };
    if (!body.peritoId || !body.senha)
      return reply.code(400).send({ error: 'peritoId e senha são obrigatórios' });
    const result = await opts.peritoAuth.login(body.peritoId, body.senha);
    if (!result.ok) return reply.code(401).send({ error: result.error });
    return { ok: true, peritoId: result.advogadoId, nome: result.nome };
  });

  // ── DOSSIÊ PERICIAL (Decreto 2026-07-21) — o HISCON parseado para o PERITO:
  //    contratos por banco (janela 5 anos), MIGRADOS (sem pedido administrativo;
  //    destinação MANUAL do admin a advogado) e indícios de estratégia.
  app.get('/admin/pericia/:chatId', async (request, reply) => {
    if (!opts.pericia) return reply.code(404).send({ error: 'perícia não configurada' });
    const { chatId } = request.params as { chatId: string };
    const dossie = await opts.pericia.dossie(chatId);
    if (dossie === null)
      return reply.code(404).send({ error: 'sem HISCON legível para este cliente' });
    return dossie;
  });

  // ABA "Contratos Migrados": todos os clientes, só contratos migrados, por banco.
  app.get('/admin/pericia-migrados', async (_request, reply) => {
    if (!opts.pericia) return reply.code(404).send({ error: 'perícia não configurada' });
    return { clientes: await opts.pericia.migradosDeTodos() };
  });

  // ── REAQUECIMENTO DE LEADS (decreto 2026-07-22) — a AHRI só reaquece com
  //    AUTORIZAÇÃO manual do admin, lead a lead. GET lista os frios (estágio,
  //    silêncio, tentativas); POST executa UM reaquecimento autorizado.
  app.get('/admin/reaquecimento', async (_request, reply) => {
    if (!opts.reaquecimento)
      return reply.code(404).send({ error: 'reaquecimento não configurado' });
    return { leads: await opts.reaquecimento.leadsFrios() };
  });

  app.post('/admin/reaquecimento/:chatId', async (request, reply) => {
    if (!opts.reaquecimento)
      return reply.code(404).send({ error: 'reaquecimento não configurado' });
    const { chatId } = request.params as { chatId: string };
    const resultado = await opts.reaquecimento.reaquecer(chatId);
    if (!resultado.ok) return reply.code(409).send({ error: resultado.error });
    return resultado;
  });

  // ── CUSTOS DE IA (2026-07-21) — o gasto REAL por cliente, do atendimento à
  //    leitura de documentos. Fonte: registros do MedidorDeCusto (tokens + preço
  //    do modelo por chamada). Leituras são atribuídas ao dono do documento pela
  //    contabilidade documental. Valores em USD são ESTIMATIVA (a fatura real é
  //    o Console do provedor).
  app.get('/admin/custos', async (_request, reply) => {
    if (!opts.custos) return reply.code(404).send({ error: 'medidor de custos não configurado' });
    const registros = await opts.custos.listar();
    const docParaChat = (await opts.pericia?.mapaDocumentoParaChat?.()) ?? {};
    const nomes = new Map(((await op.clientes?.list()) ?? []).map((c) => [c.chatId, c.quem]));

    const usd = (v: number | null): number => v ?? 0;
    const agora = new Date();
    const diaDe = (iso: string): string => iso.slice(0, 10);
    const hoje = agora.toISOString().slice(0, 10);
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 3600 * 1000).toISOString();

    interface LinhaCliente {
      chatId: string;
      nome: string | null;
      conversaUsd: number;
      leituraUsd: number;
      totalUsd: number;
      chamadas: number;
      tokensIn: number;
      tokensOut: number;
    }
    const porCliente = new Map<string, LinhaCliente>();
    const porDia = new Map<string, number>();
    const porContexto = new Map<string, { usd: number; chamadas: number }>();
    let totalUsd = 0;
    let hojeUsd = 0;
    let ultimos7DiasUsd = 0;
    let semAtribuicaoUsd = 0;
    let semAtribuicaoChamadas = 0;
    let chamadasSemPreco = 0;

    for (const r of registros) {
      const valor = usd(r.custoUsd);
      if (r.custoUsd === null) chamadasSemPreco += 1;
      totalUsd += valor;
      if (diaDe(r.at) === hoje) hojeUsd += valor;
      if (r.at >= seteDiasAtras) ultimos7DiasUsd += valor;
      porDia.set(diaDe(r.at), (porDia.get(diaDe(r.at)) ?? 0) + valor);
      const ctx = porContexto.get(r.contexto) ?? { usd: 0, chamadas: 0 };
      porContexto.set(r.contexto, { usd: ctx.usd + valor, chamadas: ctx.chamadas + 1 });

      const dono = r.chatId ?? (r.documentId !== null ? (docParaChat[r.documentId] ?? null) : null);
      if (dono === null) {
        semAtribuicaoUsd += valor;
        semAtribuicaoChamadas += 1;
        continue;
      }
      const linha = porCliente.get(dono) ?? {
        chatId: dono,
        nome: nomes.get(dono) ?? null,
        conversaUsd: 0,
        leituraUsd: 0,
        totalUsd: 0,
        chamadas: 0,
        tokensIn: 0,
        tokensOut: 0,
      };
      if (r.contexto === 'conversa') linha.conversaUsd += valor;
      else linha.leituraUsd += valor;
      linha.totalUsd += valor;
      linha.chamadas += 1;
      linha.tokensIn += r.tokensIn ?? 0;
      linha.tokensOut += r.tokensOut ?? 0;
      porCliente.set(dono, linha);
    }

    return {
      moeda: 'USD',
      aviso:
        'Estimativa calculada por tokens × preço de tabela do modelo; a fatura oficial é o Console do provedor.',
      totalUsd,
      hojeUsd,
      ultimos7DiasUsd,
      chamadas: registros.length,
      chamadasSemPreco,
      porContexto: [...porContexto.entries()].map(([contexto, v]) => ({ contexto, ...v })),
      porDia: [...porDia.entries()]
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .slice(0, 14)
        .map(([dia, v]) => ({ dia, usd: v })),
      porCliente: [...porCliente.values()].sort((a, b) => b.totalUsd - a.totalUsd),
      semAtribuicao: { usd: semAtribuicaoUsd, chamadas: semAtribuicaoChamadas },
    };
  });

  app.get('/admin/clients/:chatId/dossie', async (request, reply) => {
    await op.projector.refresh();
    const { chatId } = request.params as { chatId: string };
    const dossie = await dossieDoCliente(chatId);
    if (!dossie) return reply.code(404).send({ error: 'cliente não encontrado' });
    return dossie;
  });

  // ── TIMELINE COGNITIVA (GO-LIVE 13A · seção 5) — a HISTÓRIA do caso, derivada
  //    dos Read Models + o dossiê. Narra como a AHRI pensou. Nada recalculado na UI.
  app.get('/admin/clients/:chatId/timeline', async (request, reply) => {
    await op.projector.refresh();
    const { chatId } = request.params as { chatId: string };
    const memoryCru = await op.memoryStore.load(chatId);
    if (!memoryCru) return reply.code(404).send({ error: 'cliente não encontrado' });
    const memory = memoriaComRotulos(memoryCru, await rotulosDe(chatId));
    const dossie = await dossieDoCliente(chatId);
    const entries = await op.conversationStore.recent(chatId, 200);
    const primeiroInbound = entries.find((e) => e.kind === 'inbound');
    const missionId = op.projector.missionsOf(chatId)[0] ?? null;
    const missionTimeline = missionId ? op.projector.missionTimeline(missionId) : [];
    const documentos = memory.documentsSent.map((d) => ({
      label: d.label,
      em: d.source.at,
      reconhecidoComo: d.label,
    }));

    const timeline = montarTimelineCognitiva({
      conversaIniciadaEm: primeiroInbound?.at ?? null,
      totalMensagens: entries.filter((e) => e.kind === 'inbound' || e.kind === 'outbound').length,
      beneficio:
        dossie?.evidenciasEncontradas.find((f) => f.startsWith('beneficio='))?.split('=')[1] ??
        null,
      fatosAprendidos: dossie?.evidenciasEncontradas ?? [],
      documentos,
      contratos: dossie?.contratosEncontrados ?? [],
      raciocinio:
        dossie && dossie.hipoteses.length > 0
          ? {
              totalHipoteses: dossie.hipoteses.length,
              principal: dossie.hipoteses[0]?.ref ?? null,
              fatosDaPrincipal: dossie.explicacao.fatosUtilizados,
            }
          : null,
      decisao: dossie?.strategyRef
        ? {
            strategyRef: dossie.strategyRef,
            confianca: dossie.grauConfianca ?? 'a apurar',
            em: dossie.geradoEm,
          }
        : null,
      missao: missionId
        ? { missionId, criadaEm: missionTimeline[0]?.at ?? null, advogado: null, recebidaEm: null }
        : null,
      dossieAtualizadoEm: dossie?.geradoEm ?? null,
      encerradoEm: null,
      feedback: null,
    });
    return { chatId, timeline };
  });

  // ── PAINEL DO ADVOGADO (GO-LIVE 13A · seção 1) — cada card é um CASO. Resume o
  //    caso em segundos (confiança/hipótese/próxima ação/urgência) e a ação
  //    principal ABRE O DOSSIÊ. Derivado do dossiê + status da jornada.
  app.get('/admin/casos', async () => {
    await op.projector.refresh();
    if (!op.clientes) return { casos: [] };
    const now = Date.now();
    const clientes = await op.clientes.list();
    const casos = await Promise.all(
      clientes.map(async (c) => {
        const dossie = await dossieDoCliente(c.chatId);
        const tempoParadoMs = c.ultimoContatoAt ? now - c.ultimoContatoAt.getTime() : null;
        if (!dossie) {
          return resumirCaso({
            chatId: c.chatId,
            clienteNome: c.quem,
            status: c.status,
            tempoParadoMs,
            advogadoResponsavel: null,
            dossie: {
              grauConfianca: null,
              hipoteses: [],
              proximasAcoes: [],
              documentosPendentes: [],
              missionId: c.missionId,
            },
          });
        }
        return resumirCaso({
          chatId: c.chatId,
          clienteNome: c.quem,
          status: c.status,
          tempoParadoMs,
          advogadoResponsavel: null,
          dossie,
        });
      }),
    );
    return { casos: ordenarCasos(casos) };
  });

  // ── INTELIGÊNCIA (GO-LIVE 13A) — visualização/auditoria de como a AHRI pensa.
  //    Tudo derivado dos Read Models + catálogo; só consulta; nunca edita a IA.

  // 2. ESTRATÉGIAS — biblioteca navegável do catálogo, com estatísticas de uso.
  app.get('/admin/inteligencia/estrategias', async () => {
    const atendimentos = op.atendimentoStore ? await op.atendimentoStore.listar() : [];
    return { estrategias: montarBibliotecaEstrategias(ESTRATEGIAS_CONSIGNADO_INSS, atendimentos) };
  });

  // 4. EVOLUÇÃO DO CATÁLOGO — o painel do arquiteto (Catalog Evolution 11B/11C).
  app.get('/admin/inteligencia/evolucao', async () => {
    const atendimentos = op.atendimentoStore ? await op.atendimentoStore.listar() : [];
    return montarPainelDoArquiteto(ESTRATEGIAS_CONSIGNADO_INSS, atendimentos);
  });

  // 1. HIPÓTESES — todas as hipóteses produzidas pela AHRI (dos dossiês) + a
  //    explicação auditável "Como a AHRI chegou aqui?". 3. CONHECIMENTO — os
  //    fatos aprendidos (Conversation Knowledge), agrupados por categoria.
  app.get('/admin/inteligencia/hipoteses', async () => {
    await op.projector.refresh();
    if (!op.clientes) return { hipoteses: [] };
    const clientes = await op.clientes.list();
    const linhas: HipoteseView[] = [];
    for (const c of clientes) {
      const dossie = await dossieDoCliente(c.chatId);
      if (dossie) linhas.push(...hipotesesDoDossie(dossie, c.quem));
    }
    return { hipoteses: linhas };
  });

  app.get('/admin/inteligencia/conhecimento', async () => {
    await op.projector.refresh();
    if (!op.clientes) return { categorias: [] };
    const clientes = await op.clientes.list();
    const fatos: FatoAprendidoDeCliente[] = [];
    for (const c of clientes) {
      const entries = await op.conversationStore.recent(c.chatId, 200);
      const ultimoInbound = [...entries]
        .reverse()
        .find((e) => e.kind === 'inbound' && e.text !== null && e.text !== '');
      const context = {
        chatId: c.chatId,
        session: {
          chatId: c.chatId,
          turns: entries.length,
          lastInboundAt: null,
          lastOutboundAt: null,
        },
        recentEntries: entries,
        recentOutboundTexts: entries
          .filter((e) => e.kind === 'outbound' && e.text !== null)
          .map((e) => e.text ?? ''),
        lastPercept: ultimoInbound
          ? {
              envelope: { text: ultimoInbound.text },
              enrichment: { perceivedPurpose: 'service_request', detectedIntentSignal: null },
            }
          : null,
        silenceMs: null,
      } as unknown as ConversationContextView;
      const conhecimento = aprenderDaConversa(context, CATALOGO_CONSIGNADO_INSS);
      for (const f of conhecimento) {
        fatos.push({
          clienteId: c.chatId,
          clienteNome: c.quem,
          factKey: f.factKey,
          valor: f.valor,
          origem: f.origem,
          confianca: f.confianca,
        });
      }
    }
    return { categorias: agregarConhecimento(fatos) };
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
    if (mission.chatId === null)
      return reply.code(409).send({ error: 'missão sem conversa associada' });

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
    if (mission.chatId === null)
      return reply.code(409).send({ error: 'missão sem conversa associada' });

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
    const missions = op.projector
      .missions()
      .map((m) => ({ missionId: m.missionId, createdAt: m.createdAt }));
    const terminals = op.decisionState
      ? (await op.decisionState.all()).map((r) => ({
          missionId: r.missionId,
          terminalState: r.terminalState ?? null,
          updatedAt: r.updatedAt,
        }))
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

  // GO-LIVE-05 (BUG 2): DIAGNÓSTICO — sonda cada dependência e diz onde falhou.
  app.get('/admin/whatsapp/diagnostics', async (_request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    return op.whatsapp.diagnose();
  });

  app.get('/admin/whatsapp/apply-instructions', async (_request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    const status = await op.whatsapp.getStatus();
    if (!status.hasPendingApply)
      return {
        pending: false,
        note: 'Nenhuma configuração pendente — a aplicação já usa a instância atual.',
      };
    return {
      pending: true,
      envToSet: {
        EVOLUTION_INSTANCE: status.pending?.instance ?? '',
        WHATSAPP_NUMBER: status.pending?.number ?? '',
      },
      note: 'Config confirmada e persistida. Para APLICAR: garanta estes valores no /opt/reconstrua/.env e faça o restart controlado (o EVOLUTION_API_KEY é o retornado na criação da instância).',
      command: 'bash /opt/reconstrua/deploy.sh',
    };
  });

  // Operações DESTRUTIVAS → exigem perfil FOUNDER (x-founder-secret) além do Bearer Admin.
  app.post('/admin/whatsapp/instances', async (request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    if (!isFounder(request))
      return reply.code(403).send({ error: 'operação exige perfil Founder (x-founder-secret)' });
    const body = request.body as { instanceName?: string };
    const name = (body.instanceName ?? '').trim();
    if (name === '') return reply.code(400).send({ error: 'instanceName obrigatório' });
    return op.whatsapp.createNew(name, { role: 'founder' });
  });

  app.post('/admin/whatsapp/discard', async (request, reply) => {
    if (!op.whatsapp) return reply.code(503).send({ error: 'conexão WhatsApp indisponível' });
    if (!isFounder(request))
      return reply.code(403).send({ error: 'operação exige perfil Founder (x-founder-secret)' });
    const body = request.body as { instanceName?: string; confirm?: boolean };
    if (!body.instanceName) return reply.code(400).send({ error: 'instanceName obrigatório' });
    if (body.confirm !== true)
      return reply.code(400).send({ error: 'confirmação explícita obrigatória (confirm:true)' });
    await op.whatsapp.discard(body.instanceName, { role: 'founder' });
    return { discarded: true, instanceName: body.instanceName };
  });

  // ── DOCUMENTOS / PERÍCIAS ───────────────────────────────────────────────────
  app.get('/admin/documents', async () => {
    await op.projector.refresh();
    const memories = await op.memoryStore.all();
    const pending = memories.flatMap((m) =>
      m.documentsPending.map((d) => ({ chatId: m.chatId, document: d })),
    );
    return { recognized: op.projector.allDocuments(), pending };
  });

  // CAT-02C: conteúdo REAL do documento por documentId — uso INTERNO (servidor admin,
  // porta não publicada). Rota nova; não altera nenhuma rota existente.
  app.get('/admin/documents/:documentId/content', async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const content = op.documentContent ? await op.documentContent.byDocumentId(documentId) : null;
    if (content === null)
      return reply.code(404).send({ error: 'documento sem conteudo disponivel' });
    return reply.header('content-type', content.mime).send(Buffer.from(content.bytes));
  });

  app.get('/admin/pericias', async () => {
    await op.projector.refresh();
    return {
      pericias: op.projector.allPericias(),
      queue: (await op.handoff.openFor('perito')).length,
    };
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

  // ── BOOTSTRAP (GO-LIVE-05) — one-time, SERVER-AUTHORITATIVE ──────────────────
  // A verdade do bootstrap vive no servidor (∃ administrador ativo), nunca é
  // inferida no cliente contando a lista. Guardado pelo Bearer do Admin como todo
  // /admin/*: só quem tem o segredo inicializa. Uma vez feito, jamais reaparece.
  app.get('/admin/bootstrap', async () => ({ bootstrapped: await op.staff.isBootstrapped() }));

  app.post('/admin/bootstrap', async (request, reply) => {
    const body = request.body as { name?: string };
    if (!body.name || body.name.trim() === '')
      return reply.code(400).send({ error: 'name é obrigatório' });
    try {
      const member = await op.staff.bootstrapFirstAdmin(body.name.trim());
      return { bootstrapped: true, member };
    } catch {
      // AlreadyBootstrappedError: o sistema já foi inicializado (idempotente/one-time).
      return reply
        .code(409)
        .send({ bootstrapped: true, error: 'sistema já inicializado — o bootstrap não se repete' });
    }
  });

  app.patch('/admin/staff/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; email?: string | null; active?: boolean };
    try {
      return await op.staff.update(id, body);
    } catch (error) {
      return reply
        .code(404)
        .send({ error: error instanceof Error ? error.message : 'não encontrado' });
    }
  });

  // ── CAMPANHAS / FINANCEIRO (read models; ausência explícita, nunca inventado) ─
  app.get('/admin/campaigns', async () => {
    const metrics = await op.metricsStore.load();
    return {
      attribution: metrics?.campaignAttribution ?? {},
      available: Object.keys(metrics?.campaignAttribution ?? {}).length > 0,
    };
  });

  app.get('/admin/finance', async () => {
    const metrics = await op.metricsStore.load();
    // Decreto 2026-07-21: POTENCIAL DE RECUPERAÇÃO = o JÁ descontado até hoje
    // nos contratos do HISCON (parcelas decorridas × valor da parcela), por
    // cliente e total — direto do documento, nunca inventado.
    const potencial = opts.pericia?.potencialDeTodos
      ? await opts.pericia.potencialDeTodos().catch(() => null)
      : null;
    return {
      financialUnderAdministration: metrics?.financialUnderAdministration ?? null,
      expectedFees: null,
      available: (metrics?.financialUnderAdministration ?? null) !== null,
      potencialRecuperacao: potencial,
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
        return (
          query === '' ||
          o.name.toLowerCase().includes(query) ||
          o.component.toLowerCase().includes(query)
        );
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
