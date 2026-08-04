// ─────────────────────────────────────────────────────────────────────────────
// buildAdminServer — a API do Portal Administrativo. TODAS as rotas servem READ
// MODELS (métricas, memória, relationship, timeline projetada, workflow, health,
// observabilidade) — o portal NUNCA consulta o Event Store diretamente (item 12).
// Escritas: apenas o diretório operacional da equipe (staff) e as perguntas ao
// Founder Console (leitura narrada). NÃO inicia servidor (o `.listen` é do dono).
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { AssembledAdminOperation } from '@reconstrua/infrastructure';
import { zipStore, nomeArquivoSeguro } from '../util/zip.js';
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
  buscarConhecimento,
  listarConhecimento,
  montarTimelineCognitiva,
  ordenarCasos,
  papelPericia,
  podePapelBruto,
  prazoDosPedidos,
  projetarDados,
  redigirPii,
  resumirCaso,
  veDadoCompleto,
  CATEGORIAS_CONHECIMENTO,
  type AcaoPericia,
  type CategoriaConhecimentoPericial,
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
      /** Decreto 2026-08-04: a SOMA das ações previstas pelo guia de
       *  agrupamento (card do Centro de Comando). */
      somaAcoes?(): Promise<{
        totalAcoes: number;
        totalContratos: number;
        clientes: number;
        porCategoria: Readonly<Record<'ATIVOS' | 'EXCLUIDOS' | 'RMC' | 'RCC', number>>;
      }>;
      /** Decreto 2026-08-04: o DOSSIÊ DE AÇÕES de UM cliente — para o Admin
       *  imprimir e auditar contra o HISCON original. */
      acoesDe?(chatId: string): Promise<object | null>;
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
      /** Decreto 2026-07-27: cobrança MANUAL de CPF (lote na aba Clientes) —
       *  só quem tem HISCON e não tem CPF; trava de 24h no serviço. */
      cobrarCpf(chatId: string): Promise<{ ok: true } | { ok: false; error: string }>;
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
    /** Onda 2 (2026-07-31): convite→senha→login do ATENDIMENTO HUMANIZADO
     *  (papel 'operador' — a secretária da fase 2). */
    readonly humanizadoAuth?: {
      emitirConvite(operadorId: string, now: Date): Promise<string | null>;
      definirSenha(
        token: string,
        senha: string,
        now: Date,
      ): Promise<{ ok: true; advogadoId: string; nome: string } | { ok: false; error: string }>;
      login(
        operadorId: string,
        senha: string,
      ): Promise<{ ok: true; advogadoId: string; nome: string } | { ok: false; error: string }>;
    };
    /** Onda 2 (2026-07-31): a mesa do humanizado — clientes confirmados + docs,
     *  UF (organização por estado) e a marcação "aguardando devolução". */
    readonly humanizado?: {
      clientes(): Promise<
        readonly {
          clienteId: string;
          chatId: string;
          nome: string;
          telefone: string;
          uf: string;
          confirmadoEm: string;
          contratos: number;
          indicios: number;
          potencial: number;
          docs: { procuracao: boolean; rg: boolean; comprovante: boolean };
          completo: boolean;
          aguardandoAssinatura: boolean;
          aguardandoDesde: string | null;
          /** Descarte da secretária (2026-08-04) — fora da fila até um SIM
           *  novo do cliente ou a reativação manual. */
          descartado?: boolean;
          descartadoEm?: string | null;
        }[]
      >;
      marcarAguardando(chatId: string, valor: boolean): Promise<void>;
      /** Descarta (true) ou reativa (false) um cliente da mesa. */
      marcarDescarte?(chatId: string, valor: boolean): Promise<void>;
      /** PERFORMANCE (2026-08-04): a mesa é cara de derivar e fica em cache
       *  curto; qualquer AÇÃO do painel descarta o guardado. */
      invalidar?(): void;
    };
    /** Decreto 2026-08-03: o retrato do FUNIL para a Visão Executiva. */
    readonly funilResumo?: () => Promise<{
      fase1Completa: number;
      semParecer: number;
      aguardandoConfirmacao: number;
      confirmados: number;
      prontosParaPerito: number;
    }>;
    /** Onda 3 (2026-07-31): o PARECER EM LOTE — a base legada nunca viu o
     *  dossiê; o disparo é ato do Admin (nunca automático). */
    readonly parecerLote?: {
      pendentes(): Promise<
        readonly { clienteId: string; chatId: string; nome: string; contratos: number }[]
      >;
      enviar(clienteId: string): Promise<{ ok: boolean; motivo?: string }>;
    };
    /** Decreto 2026-07-23: cadastro/lista/painel dos SÓCIOS (identidade por CPF). */
    readonly socios?: {
      cadastrar(input: {
        cpf: string;
        nome: string;
        percentualBps: number;
        ativo?: boolean;
      }): Promise<{ ok: true; socio: unknown } | { ok: false; error: string }>;
      listaAdmin(): Promise<readonly unknown[]>;
      painel(cpf: string): Promise<unknown>;
    };
    /** Decreto 2026-07-23: convite (link) → CPF+senha → login do SÓCIO. */
    readonly socioAuth?: {
      emitirConvite(cpf: string, now: Date): Promise<string | null>;
      definirSenha(
        token: string,
        cpf: string,
        senha: string,
        now: Date,
      ): Promise<{ ok: true; cpf: string; nome: string } | { ok: false; error: string }>;
      login(
        cpf: string,
        senha: string,
      ): Promise<{ ok: true; cpf: string; nome: string } | { ok: false; error: string }>;
    };
    /** Decreto 2026-07-24: mapa de clientes (distribuição por estado/cidade). */
    readonly mapaClientes?: { gerar(): Promise<unknown> };
    /** Decreto 2026-07-26: o CPF coletado no funil — exibido no cadastro do
     *  cliente (o perito precisa dele para protocolar o pedido nos bancos). */
    readonly jornadaCpf?: (chatId: string) => Promise<string | null>;
    /** Decreto 2026-07-27: releitura comparativa do HISCON (V2 × leitura atual).
     *  compararTodos é SÓ LEITURA; aplicarLeituraDefinitiva SUBSTITUI o cache
     *  dos clientes CONFERIDOS pela auditoria (com backup) — ato do admin. */
    readonly releitura?: {
      compararTodos(limite?: number): Promise<unknown>;
      aplicarLeituraDefinitiva(): Promise<unknown>;
    };
    /** Decreto 2026-07-29: o JARVIS do Founder Console — pergunta livre
     *  fundamentada nos Read Models + comando de distribuição de contratos
     *  (plano com confirmação; NADA executa sem o clique do fundador). */
    readonly jarvis?: {
      /** Decreto 2026-07-31: chatId opcional = Jarvis EM CONTEXTO de um cliente
       *  (a caixa do cadastro) — habilita "retomar o atendimento" daquele chat. */
      perguntar(pergunta: string, chatId?: string): Promise<unknown>;
      executar(
        planoId: string,
        advogadoId: string,
        quem: string,
      ): Promise<{ ok: boolean; clientes: number; contratos: number; erros: readonly string[] }>;
      /** Cobrança de CPF em lote (HISCON sem CPF) confirmada pelo fundador. */
      cobrar(
        planoId: string,
      ): Promise<{ ok: boolean; enviados: number; pulados: number; erros: readonly string[] }>;
      /** Decreto 2026-07-30: mensagem DITADA pelo dono, confirmada no console. */
      enviarMensagem(planoId: string): Promise<{ ok: boolean; erro?: string }>;
    };
    /** Decreto 2026-07-31: o CANAL do último contato do chat (meta/evolution/
     *  webchat) — mostrado na aba Conversa do cadastro do cliente. */
    readonly canalDoChat?: (chatId: string) => Promise<string>;
    /** Decreto 2026-07-30: docs da FASE 2 humana (procuração assinada, RG,
     *  comprovante de endereço) anexados pelo time ao cliente concluso. */
    readonly docsEquipe?: {
      anexar(
        chatId: string,
        tipo: string,
        nome: string,
        base64: string,
      ): Promise<{ ok: boolean; doc?: unknown; error?: string }>;
      listar(chatId: string): Promise<readonly unknown[]>;
      baixar(
        chatId: string,
        id: string,
      ): Promise<{ nome: string; mime: string; bytes: Uint8Array } | null>;
      remover(chatId: string, id: string): Promise<boolean>;
    };
    /** Decreto 2026-07-27 (caso Roberto): o CNIS registrado aponta ao anexo
     *  ERRADO — candidatos() acha o PDF certo na conversa (só leitura);
     *  aplicar() religa, com backup, por ato explícito do dono. */
    readonly revinculo?: {
      candidatos(): Promise<unknown>;
      aplicar(chatId: string, sha256: string): Promise<unknown>;
      upload(chatId: string, pdfBase64: string, confirmar: boolean): Promise<unknown>;
    };
    /** Decreto 2026-07-24: Central de Perícia Digital (atrás de feature flag). */
    readonly periciaDigitalHabilitado?: boolean;
    readonly periciaDigital?: {
      criarCasoDoHiscon(chatId: string, numeroCaso: string, usuario: string): Promise<unknown>;
      registrarDocumento(casoId: string, input: unknown, usuario: string): Promise<unknown>;
      iniciarAnalise(casoId: string, usuario: string): Promise<unknown>;
      registrarValoresBanco(casoId: string, valores: unknown, usuario: string): Promise<unknown>;
      registrarChecklist(
        casoId: string,
        tipo: 'BIOMETRIA' | 'DOCUMENTO_ID',
        itens: unknown,
        usuario: string,
      ): Promise<unknown>;
      marcarDocumentacaoPendente(casoId: string, usuario: string): Promise<unknown>;
      registrarAchado(casoId: string, achado: unknown, usuario: string): Promise<unknown>;
      adicionarQuesito(casoId: string, quesito: unknown, usuario: string): Promise<unknown>;
      gerarMinuta(casoId: string, conclusao: unknown, usuario: string): Promise<unknown>;
      submeterRevisao(casoId: string, usuario: string): Promise<unknown>;
      solicitarAjustes(casoId: string, motivo: string, usuario: string): Promise<unknown>;
      aprovar(casoId: string, perito: unknown, usuario: string): Promise<unknown>;
      assinar(casoId: string, usuario: string): Promise<unknown>;
      liberarParaAdvogado(casoId: string, usuario: string): Promise<unknown>;
    };
    readonly periciaDigitalCasos?: {
      todos(): Promise<readonly unknown[]>;
      porId(id: string): Promise<unknown>;
    };
    readonly periciaDigitalCustodia?: {
      trilha(casoId: string): Promise<readonly unknown[]>;
      verificar(casoId: string): Promise<unknown>;
    };
    /** Decreto 2026-07-24: fluxo do perito — em perícia (10 dias), credenciais, resposta do banco. */
    readonly periciaFluxo?: {
      iniciar(
        chatId: string,
        clienteId: string,
        quem: string,
      ): Promise<{ ok: true; jaEstava: boolean }>;
      iniciarVarios(
        itens: readonly { chatId: string; clienteId: string; quem: string }[],
      ): Promise<{ novos: number; total: number }>;
      salvarCredenciais(
        chatId: string,
        cred: { email: string; senha: string; provedor: string },
      ): Promise<{ ok: boolean; error?: string }>;
      salvarRespostaBanco(chatId: string, texto: string): Promise<{ ok: boolean; error?: string }>;
      emAndamento(): Promise<readonly { chatId: string }[]>;
      concluidas(): Promise<readonly { chatId: string }[]>;
      /** Decreto 2026-07-27: estudos baixados na leitura ANTIGA voltam a
       *  "prontos p/ download" (backup preservado) — ato explícito do admin. */
      estornarTodos(): Promise<{ estornados: number }>;
      /** Decreto 2026-08-03: devolve ao estágio real quem está em perícia SEM
       *  o ciclo completo (o fluxo antigo); os aptos são preservados. */
      estornarSemCicloCompleto?(
        chatIdsAptos: readonly string[],
      ): Promise<{ estornados: number; preservados: number }>;
      listar(): Promise<readonly unknown[]>;
      registro(chatId: string): Promise<unknown>;
    };
  } = {},
): FastifyInstance {
  // Caso REAL Helio Fontes (2026-08-03): o anexo da procuração assinada
  // (docs-equipe, base64 no corpo) estourava o bodyLimit PADRÃO do Fastify
  // (1 MB) e o upload nunca concluía. 30 MB cobre a régua de 20 MB do
  // DocsEquipeService com folga para o overhead do base64 (+33%).
  const app = Fastify({ logger: false, bodyLimit: 30 * 1024 * 1024 });

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

    // Total de contratos (Centro de Comando): soma dos contratos de TODOS os
    // clientes com HISCON legível — mesma fonte do potencial (nunca recalculado).
    const totalContratos =
      potencialCC !== null ? potencialCC.porCliente.reduce((s, c) => s + c.contratos, 0) : null;

    // Decreto 2026-08-03 (pedido do dono): a Visão Executiva espelha o FUNIL
    // REAL. Sem a montagem do funil (ex.: testes), os contadores ficam em 0 —
    // nunca inventados.
    const funil = (await opts.funilResumo?.().catch(() => null)) ?? {
      fase1Completa: 0,
      semParecer: 0,
      aguardandoConfirmacao: 0,
      confirmados: 0,
      prontosParaPerito: 0,
    };
    // Decreto 2026-08-04: a SOMA das ações previstas pelo guia de agrupamento
    // (ativos 1=1 c/ exceção; excluídos ano+banco; RMC/RCC separados).
    const acoesCC = opts.pericia?.somaAcoes
      ? await opts.pericia.somaAcoes().catch(() => null)
      : null;
    const indicadores = indicadoresExecutivos({
      clientesAtivos: listaCC !== null ? listaCC.length : (metrics?.clientCount ?? 0),
      novosClientesHoje,
      totalContratos,
      dossiesGerados:
        potencialCC !== null ? potencialCC.porCliente.length : painel.totalAtendimentos,
      casosDistribuidos:
        listaCC !== null
          ? listaCC.filter((c) => c.status === 'EM_PROCESSO').length
          : (metrics?.processCount ?? 0),
      aguardandoDocumentos,
      documentosProcessados: documentosReaisCC ?? metrics?.documentCount ?? 0,
      valorRecuperavel:
        potencialCC !== null && potencialCC.porCliente.length > 0
          ? potencialCC.total
          : (metrics?.financialUnderAdministration ?? null),
      acoesPrevistas: acoesCC?.totalAcoes ?? null,
      ...funil,
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
  //
  // PERFORMANCE (2026-07-31): esta lista deriva TUDO em leitura — para CADA
  // cliente, os textos dos documentos + DOIS parses de HISCON. Com a aba
  // Clientes se atualizando a cada 8s, o mundo inteiro era recomputado toda
  // hora e a página se arrastava. CACHE DE LEITURA com validade curta (20s),
  // invalidado por qualquer ação de jornada (modalidade/venda/perícia): a
  // página voa e o dado envelhece no máximo 20s. Nada é persistido — a régua
  // continua 100% derivada.
  const cacheJornada = new Map<string, { em: number; corpo: unknown }>();
  const TTL_JORNADA_MS = 20_000;
  const invalidarCacheJornada = (): void => {
    cacheJornada.clear();
  };
  // Qualquer AÇÃO no painel (POST/PUT/DELETE) invalida o cache — o clique do
  // Admin (vender, modalidade, perícia, upload…) reflete na lista na hora; o
  // cache só serve leituras repetidas entre ações.
  app.addHook('preHandler', (request, _reply, done) => {
    if (request.method !== 'GET' && request.url.startsWith('/admin/')) {
      invalidarCacheJornada();
      // A mesa do Atendimento Humanizado também é derivada em cache curto: o
      // anexo de um documento ou a marcação da secretária refletem na hora.
      opts.humanizado?.invalidar?.();
    }
    done();
  });
  app.get('/admin/jornada/clientes', async (request, reply) => {
    if (!op.clientes) return reply.code(503).send({ error: 'jornada indisponível nesta montagem' });
    const { fila } = request.query as { fila?: string };
    const chaveCache = fila ?? '';
    const cacheado = cacheJornada.get(chaveCache);
    if (cacheado !== undefined && Date.now() - cacheado.em < TTL_JORNADA_MS) {
      return cacheado.corpo;
    }
    // As filas nomeadas do SO — todas DERIVADAS (Regra 1); B-R4 adiciona `socio`.
    const FILAS: Record<string, string> = {
      venda: 'PRONTO_AGUARDANDO_VENDA',
      pericia: 'PRONTO_AGUARDANDO_PERICIA',
      socio: 'AGUARDANDO_SOCIO',
    };
    const todos = await op.clientes.list();
    const status = fila !== undefined ? FILAS[fila] : undefined;
    let clientes = status !== undefined ? todos.filter((c) => c.status === status) : todos;
    // Decreto 2026-07-27: HISCON legível + CPF por cliente — a régua ÚNICA da
    // fase 1. A fila da perícia exige as duas coisas (mesma régua do perito —
    // fim da divergência 110×103); a lista completa expõe as flags para a aba
    // Clientes segmentar e cobrar o que falta.
    if (op.perito) {
      const comHiscon = new Map((await op.perito.todosComHiscon()).map((c) => [c.chatId, c]));
      if (fila === 'pericia') clientes = clientes.filter((c) => comHiscon.get(c.chatId)?.temCpf);
      const anotados = [];
      for (const c of clientes) {
        const h = comHiscon.get(c.chatId);
        const cpfRegistrado =
          h !== undefined
            ? h.temCpf
            : ((await opts.jornadaCpf?.(c.chatId).catch(() => null)) ?? null) !== null;
        anotados.push({ ...c, hisconLegivel: h !== undefined, cpfRegistrado });
      }
      const corpo = { clientes: anotados };
      cacheJornada.set(chaveCache, { em: Date.now(), corpo });
      return corpo;
    }
    const corpo = { clientes };
    cacheJornada.set(chaveCache, { em: Date.now(), corpo });
    return corpo;
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
    // Onda 3: as planilhas do perito respeitam a MESMA trava (ciclo completo).
    const aptos = await clientesAptosParaPedido();
    const planilhas = await op.perito.planilhasDaFila();
    return {
      planilhas: aptos === null ? planilhas : planilhas.filter((p) => aptos.has(p.clienteId)),
    };
  });

  // TRAVA DO PERITO (Onda 3, adendo do dono 2026-07-31): o pedido administrativo
  // só sai com o ciclo COMPLETO — fase 1 (CPF+HISCON) + interesse CONFIRMADO
  // após o dossiê + os 3 documentos anexados pelo Atendimento Humanizado.
  // Sem a mesa montada (opts.humanizado ausente), a trava não se aplica.
  // Cliente DESCARTADO pela secretária (2026-08-04) não conta como apto —
  // mesmo com docs completos, o caso está fora da fila até ser reativado.
  async function clientesAptosParaPedido(): Promise<Set<string> | null> {
    if (!opts.humanizado) return null;
    const mesa = await opts.humanizado.clientes();
    return new Set(mesa.filter((c) => c.completo && c.descartado !== true).map((c) => c.clienteId));
  }
  /** Os mesmos aptos, indexados por chatId (o fluxo de perícia usa o chat). */
  async function chatsAptosParaPedido(): Promise<Set<string> | null> {
    if (!opts.humanizado) return null;
    const mesa = await opts.humanizado.clientes();
    return new Set(mesa.filter((c) => c.completo && c.descartado !== true).map((c) => c.chatId));
  }

  // TODOS os clientes com HISCON legível (Decreto 2026-07-23) — o perito trabalha
  // a partir da ENTREGA do HISCON, não só da fila de sociedade. Rota ESTÁTICA
  // (resolvida antes da paramétrica :clienteId).
  app.get('/admin/jornada/pericia/todos-com-hiscon', async (_request, reply) => {
    if (!op.perito) return reply.code(503).send({ error: 'perícia indisponível nesta montagem' });
    // Decreto 2026-07-27: a fila da perícia exige a FASE 1 completa (CPF +
    // HISCON). Onda 3: e o ciclo completo (confirmação + docs do humanizado).
    const aptos = await clientesAptosParaPedido();
    const todos = (await op.perito.todosComHiscon()).filter((c) => c.temCpf);
    return { clientes: aptos === null ? todos : todos.filter((c) => aptos.has(c.clienteId)) };
  });

  // Decreto 2026-08-04: o DOSSIÊ DE AÇÕES de UM cliente — o guia de
  // classificação/agrupamento aplicado ao HISCON dele. O Admin imprime esta
  // visão e confere lado a lado com o HISCON original (auditoria da lógica).
  app.get('/admin/pericia/acoes/:chatId', async (request, reply) => {
    if (!opts.pericia?.acoesDe)
      return reply.code(503).send({ error: 'dossiê de ações indisponível nesta montagem' });
    const { chatId } = request.params as { chatId: string };
    const acoes = await opts.pericia.acoesDe(decodeURIComponent(chatId));
    if (acoes === null) return reply.code(404).send({ error: 'HISCON ainda não legível' });
    return acoes;
  });

  // Decreto 2026-07-27: RELEITURA COMPARATIVA — o leitor posicional V2 rodado
  // sobre os PDFs armazenados, lado a lado com a leitura em produção (cache).
  // SÓ LEITURA: nada é regravado; reprocessar é decisão manual do dono.
  app.get('/admin/pericia/releitura-comparativa', async (request, reply) => {
    if (!opts.releitura)
      return reply.code(503).send({ error: 'releitura indisponível nesta montagem' });
    const q = request.query as { limite?: string };
    const limiteNum = q.limite !== undefined ? Number(q.limite) : Number.NaN;
    return opts.releitura.compararTodos(Number.isFinite(limiteNum) ? limiteNum : undefined);
  });
  // APLICAR a leitura definitiva (decreto 2026-07-27): substitui o cache dos
  // clientes CONFERIDOS pela auditoria, com backup. Ato EXPLÍCITO do admin
  // (botão na página Releitura) — nunca automático.
  app.post('/admin/pericia/releitura-aplicar', async (_request, reply) => {
    if (!opts.releitura)
      return reply.code(503).send({ error: 'releitura indisponível nesta montagem' });
    return opts.releitura.aplicarLeituraDefinitiva();
  });

  // REVÍNCULO DO HISCON (decreto 2026-07-27, caso Roberto): o registrado aponta
  // ao anexo errado. GET lista os PDFs certos achados na conversa (só leitura);
  // POST religa UM chat ao sha escolhido — ato explícito do dono, com backup.
  app.get('/admin/pericia/revinculo-hiscon', async (_request, reply) => {
    if (!opts.revinculo)
      return reply.code(503).send({ error: 'revínculo indisponível nesta montagem' });
    return opts.revinculo.candidatos();
  });
  app.post('/admin/pericia/revinculo-aplicar', async (request, reply) => {
    if (!opts.revinculo)
      return reply.code(503).send({ error: 'revínculo indisponível nesta montagem' });
    const body = request.body as { chatId?: unknown; sha256?: unknown } | null;
    const chatId = typeof body?.chatId === 'string' ? body.chatId : '';
    const sha256 = typeof body?.sha256 === 'string' ? body.sha256 : '';
    if (chatId === '' || sha256 === '')
      return reply.code(400).send({ error: 'chatId e sha256 são obrigatórios' });
    return opts.revinculo.aplicar(chatId, sha256);
  });
  // UPLOAD MANUAL do HISCON (casos sem anexo capturado no acervo): o dono sobe
  // o PDF do WhatsApp dele. confirmar=false é dry-run (valida e mostra o
  // beneficiário SEM gravar); só confirmar=true grava e religa. bodyLimit
  // maior porque o PDF viaja em base64 (teto real de 20 MB validado no serviço).
  app.post(
    '/admin/pericia/revinculo-upload',
    { bodyLimit: 30 * 1024 * 1024 },
    async (request, reply) => {
      if (!opts.revinculo)
        return reply.code(503).send({ error: 'revínculo indisponível nesta montagem' });
      const body = request.body as {
        chatId?: unknown;
        pdfBase64?: unknown;
        confirmar?: unknown;
      } | null;
      const chatId = typeof body?.chatId === 'string' ? body.chatId : '';
      const pdfBase64 = typeof body?.pdfBase64 === 'string' ? body.pdfBase64 : '';
      if (chatId === '' || pdfBase64 === '')
        return reply.code(400).send({ error: 'chatId e pdfBase64 são obrigatórios' });
      return opts.revinculo.upload(chatId, pdfBase64, body?.confirmar === true);
    },
  );

  // ── FLUXO DA PERÍCIA (Decreto 2026-07-24) — o perito BAIXOU ⇒ em perícia (10
  //    dias); guarda credenciais e resposta do banco; vencido, vira "pronto p/
  //    advogado". Rotas atrás do Bearer do Admin (o portal do perito as consome).
  // ── MAPA DE CLIENTES (Decreto 2026-07-24) — distribuição por estado (DDD) + cidades.
  app.get('/admin/mapa-clientes', async (_request, reply) => {
    if (!opts.mapaClientes) return reply.code(503).send({ error: 'mapa de clientes indisponível' });
    return opts.mapaClientes.gerar();
  });

  // ── CENTRAL DE PERÍCIA DIGITAL (Decreto 2026-07-24) — atrás de FEATURE FLAG.
  //    Todas as rotas exigem periciaDigitalHabilitado; caso contrário 404 (módulo
  //    invisível). Emissão só pelo portão único do serviço (revisão humana).
  const pdOn = (): boolean => opts.periciaDigitalHabilitado === true && !!opts.periciaDigital;
  type Res = { ok: boolean; error?: string; valor?: unknown };
  const responder = (reply: FastifyReply, r: unknown): unknown => {
    const res = r as Res;
    if (!res.ok) return reply.code(422).send({ error: res.error ?? 'operação recusada' });
    return res.valor;
  };
  // ── Fase 5: RBAC por papel ──────────────────────────────────────────────────
  // O papel do ator vem do header `x-pericia-papel` (o portal o define pela
  // sessão autenticada). Fail-closed: ausente/desconhecido ⇒ nega. O portal do
  // administrador não envia o header e assume 'administrador' (mesmo poder de
  // orquestração de sempre) — mas nunca 'aprovar'/'assinar' (ato do perito).
  const papelDe = (request: FastifyRequest): string => {
    const h = request.headers['x-pericia-papel'];
    const v = (Array.isArray(h) ? h[0] : h)?.trim();
    return v && v.length > 0 ? v : 'administrador';
  };
  const autorizar = (reply: FastifyReply, papel: string, acao: AcaoPericia): boolean => {
    if (podePapelBruto(papel, acao)) return true;
    reply.code(403).send({ error: `papel "${papel}" sem permissão para: ${acao}` });
    return false;
  };
  // ── Fase 5: projeção LGPD de LEITURA ────────────────────────────────────────
  // Mascara dados pessoais e redige PII solta na minuta para papéis restritos.
  // Nunca altera o armazenamento — é só a visão entregue ao papel.
  type CasoLido = {
    dados?: { nomeCliente: string | null; cpf: string | null; numeroBeneficio: string | null };
    minutaVersoes?: { texto?: string }[];
  };
  const projetarCaso = (caso: unknown, papel: string): unknown => {
    if (veDadoCompleto(papelPericia(papel))) return caso;
    const c = caso as CasoLido;
    return {
      ...(caso as object),
      ...(c.dados
        ? {
            dados: {
              ...c.dados,
              ...projetarDados(c.dados, papelPericia(papel)),
            },
          }
        : {}),
      ...(c.minutaVersoes
        ? {
            minutaVersoes: c.minutaVersoes.map((m) => ({
              ...m,
              ...(typeof m.texto === 'string' ? { texto: redigirPii(m.texto) } : {}),
            })),
          }
        : {}),
    };
  };

  app.get('/admin/pericia-digital', async (_request, reply) => {
    if (!pdOn()) return reply.code(404).send({ error: 'módulo desativado' });
    return { habilitado: true };
  });
  // Base de Conhecimento Pericial (Fase 5C): material de CONSULTA, read-only.
  // Gated por RBAC 'ler'. Filtra por ?categoria= e/ou busca por ?q=.
  app.get('/admin/pericia-digital/conhecimento', async (request, reply) => {
    if (!pdOn()) return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'ler')) return reply;
    const q = request.query as { categoria?: string; q?: string };
    const cat = (CATEGORIAS_CONHECIMENTO as readonly string[]).includes(q.categoria ?? '')
      ? (q.categoria as CategoriaConhecimentoPericial)
      : undefined;
    const base = cat ? listarConhecimento(cat) : listarConhecimento();
    const entradas = q.q && q.q.trim() !== '' ? buscarConhecimento(q.q) : base;
    // Se veio categoria E busca, intersecta mantendo a categoria.
    const resultado =
      cat && q.q && q.q.trim() !== '' ? entradas.filter((e) => e.categoria === cat) : entradas;
    return { categorias: CATEGORIAS_CONHECIMENTO, entradas: resultado };
  });
  app.get('/admin/pericia-digital/casos', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigitalCasos)
      return reply.code(404).send({ error: 'módulo desativado' });
    const papel = papelDe(request);
    if (!autorizar(reply, papel, 'listar')) return reply;
    const casos = await opts.periciaDigitalCasos.todos();
    return { casos: casos.map((c) => projetarCaso(c, papel)) };
  });
  app.get('/admin/pericia-digital/casos/:id', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigitalCasos)
      return reply.code(404).send({ error: 'módulo desativado' });
    const papel = papelDe(request);
    if (!autorizar(reply, papel, 'ler')) return reply;
    const { id } = request.params as { id: string };
    const caso = await opts.periciaDigitalCasos.porId(id);
    if (caso === null) return reply.code(404).send({ error: 'caso não encontrado' });
    // A trilha de custódia só é entregue a quem pode vê-la (auditor/perito/admin).
    const podeCustodia = podePapelBruto(papel, 'ver_custodia');
    const trilha =
      podeCustodia && opts.periciaDigitalCustodia
        ? await opts.periciaDigitalCustodia.trilha(id)
        : [];
    const integridade =
      podeCustodia && opts.periciaDigitalCustodia
        ? await opts.periciaDigitalCustodia.verificar(id)
        : null;
    return { caso: projetarCaso(caso, papel), custodia: { trilha, integridade } };
  });
  app.post('/admin/pericia-digital/casos', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'criar')) return reply;
    const b = request.body as { chatId?: string; numeroCaso?: string };
    if (!b.chatId || !b.numeroCaso)
      return reply.code(400).send({ error: 'chatId e numeroCaso são obrigatórios' });
    return responder(
      reply,
      await opts.periciaDigital.criarCasoDoHiscon(b.chatId, b.numeroCaso, 'admin'),
    );
  });
  app.post('/admin/pericia-digital/casos/:id/documentos', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'registrar_documento')) return reply;
    const { id } = request.params as { id: string };
    return responder(
      reply,
      await opts.periciaDigital.registrarDocumento(id, request.body, 'admin'),
    );
  });
  app.post('/admin/pericia-digital/casos/:id/analise', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'iniciar_analise')) return reply;
    const { id } = request.params as { id: string };
    return responder(reply, await opts.periciaDigital.iniciarAnalise(id, 'admin'));
  });
  app.post('/admin/pericia-digital/casos/:id/valores-banco', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'registrar_valores')) return reply;
    const { id } = request.params as { id: string };
    return responder(
      reply,
      await opts.periciaDigital.registrarValoresBanco(id, request.body, 'admin'),
    );
  });
  app.post('/admin/pericia-digital/casos/:id/checklist', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'registrar_checklist')) return reply;
    const { id } = request.params as { id: string };
    const b = request.body as { tipo?: 'BIOMETRIA' | 'DOCUMENTO_ID'; itens?: unknown };
    if (b.tipo !== 'BIOMETRIA' && b.tipo !== 'DOCUMENTO_ID')
      return reply.code(400).send({ error: 'tipo inválido' });
    return responder(
      reply,
      await opts.periciaDigital.registrarChecklist(id, b.tipo, b.itens ?? [], 'admin'),
    );
  });
  app.post('/admin/pericia-digital/casos/:id/minuta', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'gerar_minuta')) return reply;
    const { id } = request.params as { id: string };
    const b = request.body as { conclusaoSugerida?: string | null };
    return responder(
      reply,
      await opts.periciaDigital.gerarMinuta(id, b.conclusaoSugerida ?? null, 'admin'),
    );
  });
  app.post('/admin/pericia-digital/casos/:id/revisao', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'submeter_revisao')) return reply;
    const { id } = request.params as { id: string };
    return responder(reply, await opts.periciaDigital.submeterRevisao(id, 'admin'));
  });
  app.post('/admin/pericia-digital/casos/:id/aprovar', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    // Ato PESSOAL do perito: só o papel 'perito' aprova (RBAC), e o serviço ainda
    // exige a identidade/registro do perito (validarAprovacaoPerito). Dupla trava.
    if (!autorizar(reply, papelDe(request), 'aprovar')) return reply;
    const { id } = request.params as { id: string };
    return responder(reply, await opts.periciaDigital.aprovar(id, request.body, 'perito'));
  });
  app.post('/admin/pericia-digital/casos/:id/assinar', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'assinar')) return reply;
    const { id } = request.params as { id: string };
    return responder(reply, await opts.periciaDigital.assinar(id, 'perito'));
  });
  app.post('/admin/pericia-digital/casos/:id/liberar', async (request, reply) => {
    if (!pdOn() || !opts.periciaDigital)
      return reply.code(404).send({ error: 'módulo desativado' });
    if (!autorizar(reply, papelDe(request), 'liberar')) return reply;
    const { id } = request.params as { id: string };
    return responder(reply, await opts.periciaDigital.liberarParaAdvogado(id, 'admin'));
  });

  app.get('/admin/jornada/pericia/em-fluxo', async (_request, reply) => {
    if (!opts.periciaFluxo) return reply.code(503).send({ error: 'fluxo de perícia indisponível' });
    // Decreto 2026-08-03 (adendo do dono): a Central do Perito mostra APENAS
    // quem completou o ciclo (confirmação + procuração + RG + comprovante).
    // As perícias iniciadas no fluxo ANTIGO ficam fora da tela até o cliente
    // percorrer o funil — o fato permanece no banco (estorno é ato do Admin).
    const chatsAptos = await chatsAptosParaPedido();
    const filtra = <T extends { chatId: string }>(itens: readonly T[]): readonly T[] =>
      chatsAptos === null ? itens : itens.filter((i) => chatsAptos.has(i.chatId));
    return {
      emAndamento: filtra(await opts.periciaFluxo.emAndamento()),
      concluidas: filtra(await opts.periciaFluxo.concluidas()),
    };
  });

  // ESTORNO GERAL (decreto 2026-07-27): os estudos baixados com a LEITURA
  // ANTIGA voltam todos a "prontos para download" — o próximo download já sai
  // com a leitura corrigida. Registros preservados em 'pericia-fluxo-backup'.
  app.post('/admin/jornada/pericia/estornar-todos', async (_request, reply) => {
    if (!opts.periciaFluxo) return reply.code(503).send({ error: 'fluxo de perícia indisponível' });
    return opts.periciaFluxo.estornarTodos();
  });

  // CADA CLIENTE NO SEU ESTÁGIO REAL (decreto 2026-08-03): as perícias
  // iniciadas no fluxo ANTIGO — antes do dossiê, da confirmação e da coleta da
  // fase 2 — voltam ao ponto real do funil. Quem completou o ciclo é
  // PRESERVADO. Ato explícito do Admin; tudo com backup (reversível).
  app.post('/admin/jornada/pericia/estornar-incompletos', async (_request, reply) => {
    if (!opts.periciaFluxo?.estornarSemCicloCompleto) {
      return reply.code(503).send({ error: 'fluxo de perícia indisponível nesta montagem' });
    }
    const chatsAptos = await chatsAptosParaPedido();
    return opts.periciaFluxo.estornarSemCicloCompleto([...(chatsAptos ?? [])]);
  });

  app.post('/admin/jornada/pericia/iniciar-todos', async (request, reply) => {
    if (!opts.periciaFluxo) return reply.code(503).send({ error: 'fluxo de perícia indisponível' });
    const body = request.body as {
      itens?: { chatId?: string; clienteId?: string; quem?: string }[];
    };
    const itens = (body.itens ?? [])
      .filter((i) => i.chatId && i.clienteId)
      .map((i) => ({ chatId: i.chatId ?? '', clienteId: i.clienteId ?? '', quem: i.quem ?? '' }));
    return opts.periciaFluxo.iniciarVarios(itens);
  });

  app.post('/admin/jornada/pericia/:chatId/iniciar', async (request, reply) => {
    if (!opts.periciaFluxo) return reply.code(503).send({ error: 'fluxo de perícia indisponível' });
    const { chatId } = request.params as { chatId: string };
    const body = request.body as { clienteId?: string; quem?: string };
    if (!body.clienteId) return reply.code(400).send({ error: 'clienteId é obrigatório' });
    return opts.periciaFluxo.iniciar(chatId, body.clienteId, body.quem ?? '');
  });

  app.post('/admin/jornada/pericia/:chatId/credenciais', async (request, reply) => {
    if (!opts.periciaFluxo) return reply.code(503).send({ error: 'fluxo de perícia indisponível' });
    const { chatId } = request.params as { chatId: string };
    const body = request.body as { email?: string; senha?: string; provedor?: string };
    if (!body.email?.trim() || !body.senha?.trim() || !body.provedor?.trim())
      return reply.code(400).send({ error: 'email, senha e provedor são obrigatórios' });
    const r = await opts.periciaFluxo.salvarCredenciais(chatId, {
      email: body.email.trim(),
      senha: body.senha.trim(),
      provedor: body.provedor.trim(),
    });
    if (!r.ok) return reply.code(409).send({ error: r.error });
    return { ok: true };
  });

  app.post('/admin/jornada/pericia/:chatId/resposta-banco', async (request, reply) => {
    if (!opts.periciaFluxo) return reply.code(503).send({ error: 'fluxo de perícia indisponível' });
    const { chatId } = request.params as { chatId: string };
    const body = request.body as { texto?: string };
    if (!body.texto?.trim()) return reply.code(400).send({ error: 'texto é obrigatório' });
    const r = await opts.periciaFluxo.salvarRespostaBanco(chatId, body.texto);
    if (!r.ok) return reply.code(409).send({ error: r.error });
    return { ok: true };
  });

  // ZIP com UM CSV POR CLIENTE (Decreto 2026-07-23) — "baixar todos" NÃO é um CSV
  // único; é um .zip com o CSV de cada cliente que tem HISCON (todos os bancos e
  // contratos dele num arquivo). Resiliente: cliente problemático é pulado (sem 500).
  app.get('/admin/jornada/pericia/planilhas-zip', async (_request, reply) => {
    if (!op.perito) return reply.code(503).send({ error: 'perícia indisponível nesta montagem' });
    // Onda 3: o zip do perito respeita a trava do ciclo completo.
    const aptosZip = await clientesAptosParaPedido();
    const todasPlanilhas = await op.perito.planilhasDeTodos();
    const planilhas =
      aptosZip === null ? todasPlanilhas : todasPlanilhas.filter((p) => aptosZip.has(p.clienteId));
    const usados = new Map<string, number>();
    const arquivos = planilhas.map((p, i) => {
      const base = nomeArquivoSeguro(p.quem, `cliente-${String(i + 1)}`);
      const n = (usados.get(base) ?? 0) + 1;
      usados.set(base, n);
      const nome = n === 1 ? `${base}.csv` : `${base} (${String(n)}).csv`;
      return { name: nome, content: p.conteudo };
    });
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', 'attachment; filename="contratos-por-cliente.zip"')
      .send(zipStore(arquivos));
  });

  // CSV ÚNICO com TODOS os clientes que têm HISCON (coluna Cliente + contratos) —
  // baixar o estudo inteiro de uma vez. Rota ESTÁTICA irmã de `/planilhas` e do
  // parâmetro `:clienteId` (find-my-way resolve estática antes de paramétrica).
  app.get('/admin/jornada/pericia/planilha-geral', async (_request, reply) => {
    if (!op.perito) return reply.code(503).send({ error: 'perícia indisponível nesta montagem' });
    const gerada = await op.perito.planilhaGeral();
    return reply
      .header('content-type', gerada.mime)
      .header('content-disposition', `attachment; filename="${gerada.nomeArquivo}"`)
      .send(gerada.conteudo);
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
    // Decreto 2026-07-26: o CPF do funil viaja no cadastro (null enquanto a
    // pessoa não informou — nunca inventado, nunca inferido do telefone).
    const cpf = opts.jornadaCpf ? await opts.jornadaCpf(chatId).catch(() => null) : null;
    // Decreto 2026-07-31: o canal do último contato (meta/evolution/webchat).
    const canal = opts.canalDoChat ? await opts.canalDoChat(chatId).catch(() => null) : null;
    return {
      memory: memoriaComRotulos(memory, await rotulosDe(chatId)),
      cpf,
      relationship,
      conversation,
      canal,
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

  // ── ATENDIMENTO HUMANIZADO (Onda 2, decreto 2026-07-31) — a SECRETÁRIA:
  //    convite emitido na aba Operadores → senha própria → login por CPF.
  //    A mesa lista SÓ quem CONFIRMOU o parecer (cadastro gerado). ────────────
  app.post('/admin/humanizado/convite', async (request, reply) => {
    if (!opts.humanizadoAuth)
      return reply.code(503).send({ error: 'autenticação do humanizado indisponível' });
    const body = request.body as { operadorId?: string };
    if (!body.operadorId) return reply.code(400).send({ error: 'operadorId obrigatório' });
    const token = await opts.humanizadoAuth.emitirConvite(body.operadorId, new Date());
    if (token === null)
      return reply.code(404).send({ error: 'operador(a) não encontrado(a) ou inativo(a)' });
    return { operadorId: body.operadorId, token, validadeDias: 7 };
  });

  app.post('/admin/humanizado/definir-senha', async (request, reply) => {
    if (!opts.humanizadoAuth)
      return reply.code(503).send({ error: 'autenticação do humanizado indisponível' });
    const body = request.body as { token?: string; senha?: string };
    if (!body.token || !body.senha)
      return reply.code(400).send({ error: 'token e senha são obrigatórios' });
    const result = await opts.humanizadoAuth.definirSenha(body.token, body.senha, new Date());
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true, operadorId: result.advogadoId, nome: result.nome };
  });

  app.post('/admin/humanizado/login', async (request, reply) => {
    if (!opts.humanizadoAuth)
      return reply.code(503).send({ error: 'autenticação do humanizado indisponível' });
    const body = request.body as { login?: string; senha?: string };
    if (!body.login || !body.senha)
      return reply.code(400).send({ error: 'login (CPF ou id) e senha são obrigatórios' });
    // Login HUMANO por CPF (o id interno segue valendo — retrocompatível).
    let operadorId = body.login.trim();
    const digitos = operadorId.replace(/\D/g, '');
    if (digitos.length === 11) {
      const operadores = await op.staff.list('operador');
      const porCpf = operadores.find((m) => (m.cpf ?? '').replace(/\D/g, '') === digitos);
      if (porCpf !== undefined) operadorId = porCpf.id;
    }
    const result = await opts.humanizadoAuth.login(operadorId, body.senha);
    if (!result.ok) return reply.code(401).send({ error: result.error });
    return { ok: true, operadorId: result.advogadoId, nome: result.nome };
  });

  app.get('/admin/humanizado/clientes', async (_request, reply) => {
    if (!opts.humanizado)
      return reply.code(503).send({ error: 'mesa do humanizado indisponível nesta montagem' });
    return { clientes: await opts.humanizado.clientes() };
  });

  // A secretária marca "documentação enviada — aguardando devolução assinada".
  app.post('/admin/humanizado/clientes/:chatId/aguardando', async (request, reply) => {
    if (!opts.humanizado)
      return reply.code(503).send({ error: 'mesa do humanizado indisponível nesta montagem' });
    const { chatId } = request.params as { chatId: string };
    const body = (request.body ?? {}) as { valor?: boolean };
    await opts.humanizado.marcarAguardando(chatId, body.valor === true);
    return { ok: true, aguardando: body.valor === true };
  });

  // DESCARTE (2026-08-04): sem interesse ou sem documentação, o cliente sai da
  // fila da secretária. valor=false reativa; um SIM novo do cliente também.
  app.post('/admin/humanizado/clientes/:chatId/descartar', async (request, reply) => {
    if (!opts.humanizado?.marcarDescarte)
      return reply.code(503).send({ error: 'descarte indisponível nesta montagem' });
    const { chatId } = request.params as { chatId: string };
    const body = (request.body ?? {}) as { valor?: boolean };
    await opts.humanizado.marcarDescarte(chatId, body.valor === true);
    return { ok: true, descartado: body.valor === true };
  });

  // ── PARECER EM LOTE (Onda 3) — a base LEGADA (cadastro do fluxo antigo)
  //    nunca recebeu o dossiê+confirmação; o disparo é um CLIQUE do Admin.
  //    O fato do parecer é o claim (envio único — repetir o lote não duplica).
  app.get('/admin/jornada/clientes/parecer-lote', async (_request, reply) => {
    if (!opts.parecerLote)
      return reply.code(503).send({ error: 'parecer em lote indisponível nesta montagem' });
    return { pendentes: await opts.parecerLote.pendentes() };
  });

  app.post('/admin/jornada/clientes/parecer-lote', async (_request, reply) => {
    if (!opts.parecerLote)
      return reply.code(503).send({ error: 'parecer em lote indisponível nesta montagem' });
    const pendentes = await opts.parecerLote.pendentes();
    let enviados = 0;
    let pulados = 0;
    const erros: string[] = [];
    for (const p of pendentes) {
      const r = await opts.parecerLote.enviar(p.clienteId).catch(() => ({
        ok: false as const,
        motivo: 'falha inesperada',
      }));
      if (r.ok) enviados += 1;
      else {
        pulados += 1;
        erros.push(`${p.nome}: ${r.motivo ?? 'não enviado'}`);
      }
    }
    return { ok: true, enviados, pulados, erros };
  });

  // ── SÓCIOS (Decreto 2026-07-23) — o Admin cadastra o sócio (CPF+nome+participação)
  //    e gera o LINK; o sócio cria a PRÓPRIA senha confirmando o CPF e entra só com
  //    CPF+senha. Rateio do potencial recuperável de TODOS os HISCON. Rotas atrás do
  //    Bearer do Admin (só os portais o têm — o portal do sócio repassa o login).
  app.post('/admin/socios/cadastrar', async (request, reply) => {
    if (!opts.socios) return reply.code(503).send({ error: 'painel de sócios indisponível' });
    const body = request.body as {
      cpf?: string;
      nome?: string;
      percentualBps?: number;
      ativo?: boolean;
    };
    if (!body.cpf || !body.nome || typeof body.percentualBps !== 'number')
      return reply.code(400).send({ error: 'cpf, nome e percentualBps são obrigatórios' });
    const result = await opts.socios.cadastrar({
      cpf: body.cpf,
      nome: body.nome,
      percentualBps: body.percentualBps,
      ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
    });
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true, socio: result.socio };
  });

  app.get('/admin/socios', async (_request, reply) => {
    if (!opts.socios) return reply.code(503).send({ error: 'painel de sócios indisponível' });
    return { socios: await opts.socios.listaAdmin() };
  });

  app.post('/admin/socios/convite', async (request, reply) => {
    if (!opts.socioAuth) return reply.code(503).send({ error: 'painel de sócios indisponível' });
    const body = request.body as { cpf?: string };
    if (!body.cpf) return reply.code(400).send({ error: 'cpf obrigatório' });
    const token = await opts.socioAuth.emitirConvite(body.cpf, new Date());
    if (token === null) return reply.code(404).send({ error: 'sócio não encontrado ou inativo' });
    return { cpf: body.cpf, token, validadeDias: 7 };
  });

  app.post('/admin/socio/definir-senha', async (request, reply) => {
    if (!opts.socioAuth) return reply.code(503).send({ error: 'painel de sócios indisponível' });
    const body = request.body as { token?: string; cpf?: string; senha?: string };
    if (!body.token || !body.cpf || !body.senha)
      return reply.code(400).send({ error: 'token, cpf e senha são obrigatórios' });
    const result = await opts.socioAuth.definirSenha(body.token, body.cpf, body.senha, new Date());
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true, cpf: result.cpf, nome: result.nome };
  });

  app.post('/admin/socio/login', async (request, reply) => {
    if (!opts.socioAuth) return reply.code(503).send({ error: 'painel de sócios indisponível' });
    const body = request.body as { cpf?: string; senha?: string };
    if (!body.cpf || !body.senha)
      return reply.code(400).send({ error: 'cpf e senha são obrigatórios' });
    const result = await opts.socioAuth.login(body.cpf, body.senha);
    if (!result.ok) return reply.code(401).send({ error: result.error });
    return { ok: true, cpf: result.cpf, nome: result.nome };
  });

  app.get('/admin/socio/painel/:cpf', async (request, reply) => {
    if (!opts.socios) return reply.code(503).send({ error: 'painel de sócios indisponível' });
    const { cpf } = request.params as { cpf: string };
    const painel = await opts.socios.painel(cpf);
    if (painel === null) return reply.code(404).send({ error: 'sócio não encontrado ou inativo' });
    return painel;
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

  // COBRANÇA MANUAL DE CPF (decreto 2026-07-27): o admin dispara da aba
  // Clientes (unitário ou lote no cliente) — regras duras no serviço.
  app.post('/admin/reaquecimento-cpf/:chatId', async (request, reply) => {
    if (!opts.reaquecimento)
      return reply.code(404).send({ error: 'reaquecimento não configurado' });
    const { chatId } = request.params as { chatId: string };
    const r = await opts.reaquecimento.cobrarCpf(chatId);
    if (!r.ok) return reply.code(409).send({ error: r.error });
    return r;
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
    const body = request.body as {
      role?: string;
      name?: string;
      email?: string | null;
      cpf?: string | null;
    };
    if (!body.role || !isStaffRole(body.role) || !body.name) {
      return reply.code(400).send({ error: 'role e name são obrigatórios' });
    }
    try {
      return await op.staff.register(body.role, body.name, body.email ?? null, body.cpf ?? null);
    } catch (error) {
      return reply
        .code(400)
        .send({ error: error instanceof Error ? error.message : 'falha ao cadastrar' });
    }
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
    const body = request.body as {
      name?: string;
      email?: string | null;
      active?: boolean;
      cpf?: string | null;
    };
    try {
      return await op.staff.update(id, body);
    } catch (error) {
      // CPF inválido é erro do pedido (400); membro inexistente é 404.
      const msg = error instanceof Error ? error.message : 'não encontrado';
      return reply.code(msg.includes('CPF') ? 400 : 404).send({ error: msg });
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

  // ── JARVIS (decreto 2026-07-29) — a AHRI como assistente do fundador ─────────
  // Pergunta livre fundamentada nos Read Models; comando de distribuição gera
  // um PLANO que só executa após a confirmação explícita (com o advogado).
  app.post('/admin/founder/jarvis', async (request, reply) => {
    if (!opts.jarvis) return reply.code(503).send({ error: 'jarvis indisponível nesta montagem' });
    const body = request.body as { pergunta?: string; chatId?: string };
    if (!body.pergunta || body.pergunta.trim() === '')
      return reply.code(400).send({ error: 'pergunta obrigatória' });
    // Decreto 2026-07-31: chatId opcional = Jarvis em CONTEXTO de um cliente
    // (a caixa do cadastro) — habilita "retomar o atendimento" daquele chat.
    const chatId =
      typeof body.chatId === 'string' && body.chatId.trim() !== '' ? body.chatId.trim() : undefined;
    return opts.jarvis.perguntar(body.pergunta.trim(), chatId);
  });
  app.post('/admin/founder/jarvis/executar', async (request, reply) => {
    if (!opts.jarvis) return reply.code(503).send({ error: 'jarvis indisponível nesta montagem' });
    const body = request.body as { planoId?: string; advogadoId?: string };
    if (!body.planoId || !body.advogadoId)
      return reply.code(400).send({ error: 'planoId e advogadoId são obrigatórios' });
    return opts.jarvis.executar(body.planoId, body.advogadoId, 'founder-console');
  });
  // COBRANÇA DE CPF confirmada pelo fundador (o plano lista os alvos; a rotina
  // é a MESMA da aba Clientes — trava de 24h vale sempre).
  app.post('/admin/founder/jarvis/cobrar', async (request, reply) => {
    if (!opts.jarvis) return reply.code(503).send({ error: 'jarvis indisponível nesta montagem' });
    const body = request.body as { planoId?: string };
    if (!body.planoId) return reply.code(400).send({ error: 'planoId é obrigatório' });
    return opts.jarvis.cobrar(body.planoId);
  });
  // MENSAGEM DITADA (decreto 2026-07-30, fim dos automáticos): o texto sai
  // EXATAMENTE como o dono ditou, só após a confirmação no console.
  app.post('/admin/founder/jarvis/enviar', async (request, reply) => {
    if (!opts.jarvis) return reply.code(503).send({ error: 'jarvis indisponível nesta montagem' });
    const body = request.body as { planoId?: string };
    if (!body.planoId) return reply.code(400).send({ error: 'planoId é obrigatório' });
    return opts.jarvis.enviarMensagem(body.planoId);
  });

  // ── DOCS DA EQUIPE (decreto 2026-07-30) — fase 2 humana: o time anexa a
  //    procuração assinada, o RG e o comprovante ao cliente concluso da fase 1.
  //    Vai ao MESMO media store; o Portal do Advogado lê daqui os downloads. ──
  const TIPOS_DOC_EQUIPE = new Set(['procuracao', 'rg', 'comprovante', 'outro']);
  app.get('/admin/clientes/:chatId/docs-equipe', async (request, reply) => {
    if (!opts.docsEquipe)
      return reply.code(503).send({ error: 'docs da equipe indisponíveis nesta montagem' });
    const { chatId } = request.params as { chatId: string };
    return { docs: await opts.docsEquipe.listar(chatId) };
  });
  app.post('/admin/clientes/:chatId/docs-equipe', async (request, reply) => {
    if (!opts.docsEquipe)
      return reply.code(503).send({ error: 'docs da equipe indisponíveis nesta montagem' });
    const { chatId } = request.params as { chatId: string };
    const body = request.body as { tipo?: string; nome?: string; base64?: string };
    if (!body.tipo || !TIPOS_DOC_EQUIPE.has(body.tipo) || !body.base64)
      return reply
        .code(400)
        .send({ error: 'tipo (procuracao|rg|comprovante|outro) e base64 são obrigatórios' });
    const r = await opts.docsEquipe.anexar(chatId, body.tipo, body.nome ?? '', body.base64);
    if (!r.ok) return reply.code(400).send(r);
    return r;
  });
  app.get('/admin/clientes/:chatId/docs-equipe/:id/content', async (request, reply) => {
    if (!opts.docsEquipe)
      return reply.code(503).send({ error: 'docs da equipe indisponíveis nesta montagem' });
    const { chatId, id } = request.params as { chatId: string; id: string };
    const doc = await opts.docsEquipe.baixar(chatId, id);
    if (doc === null) return reply.code(404).send({ error: 'documento não encontrado' });
    return reply
      .header('content-type', doc.mime)
      .header('content-disposition', `attachment; filename="${doc.nome.replace(/"/g, '')}"`)
      .send(Buffer.from(doc.bytes));
  });
  app.delete('/admin/clientes/:chatId/docs-equipe/:id', async (request, reply) => {
    if (!opts.docsEquipe)
      return reply.code(503).send({ error: 'docs da equipe indisponíveis nesta montagem' });
    const { chatId, id } = request.params as { chatId: string; id: string };
    const removido = await opts.docsEquipe.remover(chatId, id);
    if (!removido) return reply.code(404).send({ error: 'documento não encontrado' });
    return { ok: true };
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
