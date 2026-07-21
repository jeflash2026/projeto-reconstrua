// ─────────────────────────────────────────────────────────────────────────────
// assembleProduction — a COMPOSIÇÃO DE PRODUÇÃO REAL. Um único processo com o
// SUPERSET da operação (2A→3D), selecionando adapters REAIS por configuração:
//   • Postgres (DATABASE_URL) ou in-memory (dev/test) — só adapters trocam;
//   • Evolution real (ENV) com HTTP resiliente, ou gateway in-memory;
//   • LLM real (OpenAI/Anthropic/Gemini) nos 4 ports de linguagem, ou offline.
// Nenhum runtime congelado muda. Devolve visões estruturais para os servidores
// congelados (admin/advogado/lx) + monitor + Go-Live de produção.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type {
  AdminMetricsStore,
  ConfigStore,
  ConversationGateway,
  ConversationRuntime,
  EventStore,
  MemoryStore,
  OutboxStore,
  ProductionConfig,
  SnapshotStore,
  Sleeper,
} from '@reconstrua/application';
import {
  AcompanhamentoView,
  DespedidaRuntime,
  NascimentoPortalRuntime,
  PACOTE_CASO_EM_ABERTURA,
  PACOTE_SEM_CASO,
  PROMPT_TRADUCAO_CLIENTE,
  TraducaoClienteRuntime,
  emitirTokenCliente,
  pacoteDeEstado,
  AdvogadoAhriBridge,
  AdvogadoAuthRuntime,
  AdvogadoWorkRuntime,
  BootRuntime,
  ClientesList,
  CsvPlanilhaExporter,
  PeritoView,
  ConversationContextRuntime,
  ConversationMemoryRuntime,
  ConversationRuntime as ConversationRuntimeClass,
  CursorRuntime,
  DEFAULT_HUMANIZATION_POLICY,
  DEFAULT_NOTIFICATION_POLICY,
  DecisionGateRuntime,
  DelayRuntime,
  DeliveryRuntime,
  EventStoreIntegrityAuditor,
  FollowUpRecurrenceRuntime,
  ExponentialBackoffRetryPolicy,
  GoLiveChecklist,
  HealthRuntime,
  HumanHandoffRuntime,
  HumanLikeTimingRuntime,
  MessageQueueRuntime,
  NotificationRuntime,
  ObservabilityRuntime,
  OutboxRuntime,
  PortalIntegrationRuntime,
  PresenceRuntime,
  ProductivityRuntime,
  PromptBuilderRuntime,
  SchedulerRuntime,
  SessionRuntime,
  SilenceDetectionRuntime,
  StaffDirectoryRuntime,
  SubscriberRegistry,
  TemporalSignalDispatcher,
  TimelineProjector,
  TypingRuntime,
  WorkflowRuntime,
  configFromEnv,
  DEFAULT_PRODUCTION_CONFIG,
  InMemoryAtendimentoStore,
  ProductionFeedbackLoop,
  DocumentRequestRuntime,
  ANY_VERSION,
  type PendenciaDocumentalProvider,
  OnboardingDocumentalRuntime,
  type OnboardingDocumentalProvider,
  type EnviadorDeDocumento,
} from '@reconstrua/application';
import type { BootableComponent } from '@reconstrua/application';
import { MissionClosureFeedbackSubscriber, defaultEncerramentoResolver } from '../pipeline/mission-closure-feedback-subscriber.js';
import { JsonDocumentRequestStore } from '../document-request/json-document-request-store.js';
import { DocumentRequestsAwareSnapshotAdapter } from '../document-request/document-requests-snapshot-adapter.js';
import { DocumentArrivalSubscriber } from '../document-request/document-arrival-subscriber.js';
import { DocumentRequestComunicador } from '../document-request/document-request-comunicador.js';
import { DocumentRequestAutonomia } from '../document-request/autonomia.js';
import { JsonNotificationChannelStore, LawyerNotifierSubscriber } from '../document-request/lawyer-notifier.js';
import { JsonAnexoStore } from '../document-request/json-anexo-store.js';
import { JsonOnboardingDocumentalStore } from '../onboarding/json-onboarding-store.js';
import { JornadaComercialRuntime } from '../jornada/jornada-runtime.js';
import { JourneyGovernedExpression } from '../jornada/journey-governed-expression.js';
import { OnboardingDocumentalSubscriber, criarResolverDeChat } from '../onboarding/onboarding-documental-subscriber.js';
import { online } from '@reconstrua/application';
import { InMemoryEventStore } from '../event-store/in-memory-event-store.js';
import { InMemorySnapshotStore } from '../event-store/in-memory-snapshot-store.js';
import { PgEventStore } from '../event-store/pg-event-store.js';
import { PgOutboxStore } from '../event-store/pg-outbox-store.js';
import { PostgresSqlClient } from '../event-store/postgres-sql-client.js';
import { CryptoHasher } from '../event-store/crypto-hasher.js';
import { InMemoryDeliveryStore } from '../event-dispatcher/in-memory-delivery-store.js';
import { InMemoryIdempotencyStore } from '../event-dispatcher/in-memory-idempotency-store.js';
import { PgDeliveryStore } from '../event-dispatcher/pg-delivery-store.js';
import { PgIdempotencyStore } from '../event-dispatcher/pg-idempotency-store.js';
import {
  InMemoryConversationGateway,
  InMemoryMessageQueueStore,
  SystemSleeper,
  FetchHttpClient,
  EvolutionGateway,
  criarMissaoProvider,
} from '../conversation/index.js';
import { assembleExecutiveBrain } from '../executive-brain/build-executive-brain.js';
// RFC-0035-G: fronteira de decisão como Read Model Projection (Alternativa B).
import { JsonDecisionStateStore } from '../executive-brain/decision-state-read-model.js';
import { DecisionStateProjectionSubscriber } from '../executive-brain/decision-state-projection-subscriber.js';
import { ProjectionBackedMissionSnapshotAdapter } from '../executive-brain/projection-backed-mission-snapshot-adapter.js';
import { InMemoryRuleCatalog } from '../executive-brain/in-memory-adapters.js';
import { assembleMissionRuntime } from '../mission-runtime/build-mission-runtime.js';
import { assembleALIR, type AssembledALIR } from '../alir/build-alir.js';
import { BrainNascimentoComunicador } from '../portal-cliente/nascimento-comunicador.js';
import { BrainDespedidaComunicador } from '../portal-cliente/despedida-comunicador.js';
import { assembleLivingMemory } from '../living-memory/build-living-memory.js';
import { assembleAdministration } from '../administration/build-administration.js';
import { AdminProjectionSubscriber } from '../administration/admin-projection-subscriber.js';
import { RecordingNotificationChannel } from '../go-live/in-memory-adapters.js';
import { FullLoopBrainAdapter } from '../go-live/full-loop-brain-adapter.js';
import { SerializedSubscriber } from '../go-live/serialized-subscriber.js';
import { NightShiftRuntime } from '../lawyer-experience/night-shift-runtime.js';
import { AfterDecisionRuntime } from '../lawyer-experience/after-decision-runtime.js';
import { PlantaoService } from '../lawyer-experience/plantao-service.js';
import type { AssembledAdvogadoOperation } from '../advogado-portal/build-advogado-operation.js';
import { ADVOGADO_RULE_CATALOG } from '../advogado-portal/advogado-rule-catalog.js';
import { ConversationClientMessenger } from '../advogado-portal/client-messenger.js';
import type { AssembledAdminOperation } from '../admin-portal/build-admin-operation.js';
import type { AssembledLawyerExperience } from '../lawyer-experience/build-lawyer-experience.js';
import { InMemoryJsonStore, PgJsonStore, type JsonStore } from './json-store.js';
import {
  JsonAssignmentStore,
  JsonConfigStore,
  JsonConversationStore,
  JsonCredenciaisAdvogadoStore,
  JsonCursorStore,
  JsonDecisionStore,
  JsonDespedidaStore,
  JsonHandoffStore,
  JsonIdentityMap,
  JsonJuridicalWorkStore,
  JsonLiberacaoPortalStore,
  JsonMemoryStore,
  JsonMetricsStore,
  JsonModalidadeStore,
  JsonPedidosAdministrativosStore,
  JsonProductivityStore,
  JsonVendaStore,
  JsonProgressStore,
  JsonSchedulerStore,
  JsonSessionStore,
  JsonStaffStore,
} from './document-stores.js';
import { ResilientHttpClient } from './resilient-http.js';
import { createLlmBundle, type LlmBundle } from './llm-adapters.js';
import { ProductionIngress } from './production-ingress.js';
import { PRODUCTION_RULE_CATALOG } from './production-rule-catalog.js';
import { JsonShadowStore, ShadowRecorder, type ShadowStore, type TurnIngress } from './shadow.js';
import {
  ChainedMediaGateway,
  DirectWhatsAppMediaClient,
  DocumentContentService,
  DocumentLinkSubscriber,
  EvolutionMediaClient,
  InMemoryMediaStore,
  JsonDocumentLinkStore,
  JsonMediaReferenceStore,
  MediaCaptureRuntime,
  PgMediaStore,
  type MediaStorePort,
} from '../media/index.js';
import { AnthropicVisionClient, DocumentReaderService, JsonDocumentTextCache } from '../reading/index.js';
import { EvolutionInstanceClient, FetchEvoHttp, WhatsAppConnectionRuntime } from '../whatsapp-connection/index.js';

export interface ProductionWiring {
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Overrides de teste (gateway/sleeper/config). */
  readonly gateway?: ConversationGateway;
  readonly sleeper?: Sleeper;
  readonly config?: ProductionConfig;
}

export interface AssembledProduction {
  /** ENTRADA ÚNICA de produção (A2/4C): turnos serializados por conversa.
   *  Em SHADOW_MODE (4D), é o ShadowRecorder envolvendo a mesma entrada. */
  readonly ingress: TurnIngress;
  /** Shadow Mode (4D): recorder + store de reports (sempre montados; ativo por flag). */
  readonly shadow: ShadowRecorder;
  readonly shadowStore: ShadowStore;
  readonly shadowMode: boolean;
  readonly mode: { readonly storage: 'postgres' | 'memory'; readonly gateway: 'evolution' | 'memory'; readonly llm: string };
  readonly config: ProductionConfig;
  readonly configStore: ConfigStore;
  readonly conversation: ConversationRuntime;
  readonly gateway: ConversationGateway;
  readonly adminView: AssembledAdminOperation;
  readonly advogadoView: AssembledAdvogadoOperation;
  readonly lxView: AssembledLawyerExperience;
  readonly health: HealthRuntime;
  readonly observability: ObservabilityRuntime;
  readonly boot: BootRuntime;
  readonly bootComponents: readonly BootableComponent[];
  readonly scheduler: SchedulerRuntime;
  readonly temporal: TemporalSignalDispatcher;
  readonly outbox: OutboxRuntime;
  readonly memoryStore: MemoryStore;
  readonly metricsStore: AdminMetricsStore;
  readonly llm: LlmBundle;
  readonly databaseUrl: string | null;
  /** CAT-02A: captura assíncrona dos bytes reais de documentos (best-effort). */
  readonly mediaCapture: MediaCaptureRuntime;
  /** CAT-03A: transforma um documento em texto bruto (disponível; sem gatilho automático). */
  readonly documentReader: DocumentReaderService;
  /** GO LIVE A · R1: a visão única do cliente (ALIR) + persona Operador de Qualificação. */
  readonly alir: AssembledALIR;
  /** PC-R1: a projeção segura do processo para o CLIENTE (Portal + AHRI — Princípio 3). */
  readonly acompanhamento: AcompanhamentoView;
  /** PC-R3: o NASCIMENTO do Portal — varredura automática (tick), sem clique humano. */
  readonly nascimento: NascimentoPortalRuntime;
  /** GO-LIVE-02: a DESPEDIDA (Modelo A) — a relação se encerra como começou: conversando. */
  readonly despedida: DespedidaRuntime;
  /** GO-LIVE-02: tradução humanizada das anotações do advogado (fail-closed; tick reprocessa). */
  readonly traducao: TraducaoClienteRuntime;
}

export function assembleProduction(wiring: ProductionWiring): AssembledProduction {
  const { clock, uuid } = wiring;
  const env = wiring.env ?? {};
  const config = wiring.config ?? configFromEnv(env);
  const hasher = new CryptoHasher();
  const health = new HealthRuntime();
  const observability = new ObservabilityRuntime();
  const policy = DEFAULT_HUMANIZATION_POLICY;
  const sleeper = wiring.sleeper ?? new SystemSleeper();

  // ── Seleção de armazenamento (Postgres real quando DATABASE_URL) ─────────────
  const databaseUrl = env['DATABASE_URL'] ?? null;
  let json: JsonStore;
  let eventStore: EventStore;
  let outboxStore: OutboxStore;
  let deliveries: InMemoryDeliveryStore | PgDeliveryStore;
  let idempotency: InMemoryIdempotencyStore | PgIdempotencyStore;
  let snapshotStore: SnapshotStore | undefined;
  let mediaStore: MediaStorePort;
  if (databaseUrl !== null) {
    const sql = PostgresSqlClient.connect(databaseUrl);
    json = new PgJsonStore(sql);
    mediaStore = new PgMediaStore(sql);
    const pgEvents = new PgEventStore(sql, hasher, uuid);
    eventStore = pgEvents;
    outboxStore = new PgOutboxStore(sql);
    deliveries = new PgDeliveryStore(sql);
    idempotency = new PgIdempotencyStore(sql);
    snapshotStore = undefined;
  } else {
    json = new InMemoryJsonStore();
    mediaStore = new InMemoryMediaStore();
    const memEvents = new InMemoryEventStore(hasher, uuid, clock);
    eventStore = memEvents;
    outboxStore = memEvents;
    deliveries = new InMemoryDeliveryStore();
    idempotency = new InMemoryIdempotencyStore();
    snapshotStore = new InMemorySnapshotStore();
  }
  void snapshotStore;

  const configStore = new JsonConfigStore(json);
  const memoryStore = new JsonMemoryStore(json);
  const metricsStore = new JsonMetricsStore(json);
  const conversationStore = new JsonConversationStore(json);
  const sessionStore = new JsonSessionStore(json);
  const schedulerStore = new JsonSchedulerStore(json);
  const handoffStore = new JsonHandoffStore(json);
  const progressStore = new JsonProgressStore(json);
  const staffStore = new JsonStaffStore(json);
  const assignmentStore = new JsonAssignmentStore(json);
  const juridicalStore = new JsonJuridicalWorkStore(json);
  const cursorStore = new JsonCursorStore(json);
  const decisionStore = new JsonDecisionStore(json);
  const productivityStore = new JsonProductivityStore(json);
  const identityMap = new JsonIdentityMap(json);
  // RFC-0035-G: Read Model de DECISÃO (por missão) que respalda a fronteira do Brain.
  const decisionState = new JsonDecisionStateStore(json);

  // ── GO LIVE A · R1: ALIR ligado aos stores REAIS (visão única do cliente) ─────
  const alir = assembleALIR({
    identityMap,
    memoryStore,
    decisionState,
    progressStore,
    schedulerStore,
    handoffStore,
    assignmentStore,
    staffStore,
    juridicalStore,
  });

  // ── GO LIVE A · R2/R3: lista única (status derivado) + modalidade + venda ─────
  const modalidadeStore = new JsonModalidadeStore(json);
  const vendaStore = new JsonVendaStore(json);
  const pedidosStore = new JsonPedidosAdministrativosStore(json);
  const clientes = new ClientesList({
    memory: memoryStore,
    alir: alir.builder,
    modalidade: modalidadeStore,
    venda: vendaStore,
    pedidos: pedidosStore,
  });

  // ── PORTAL DO CLIENTE · PC-R1/R3/R4: a projeção segura ÚNICA (Portal + AHRI) ──
  // D1: PROCESSING_ESTIMATE_DAYS lida AQUI, em um único ponto — Portal e mensagens
  // da AHRI consomem o MESMO valor. D3: a visão só compõe; nada nasce nela.
  const officialNumber = (env['OFFICIAL_WHATSAPP_NUMBER'] ?? '554137989737').replace(/\D/g, '');
  const estimativaDias = Number(env['PROCESSING_ESTIMATE_DAYS'] ?? '12');
  const clientePortalSecret = env['CLIENTE_PORTAL_SECRET'] ?? '';
  const liberacaoStore = new JsonLiberacaoPortalStore(json);
  const despedidaStore = new JsonDespedidaStore(json);
  const acompanhamento = new AcompanhamentoView({
    clientes,
    memory: memoryStore,
    juridical: juridicalStore,
    assignments: assignmentStore,
    staff: staffStore,
    liberacao: (clienteId) => liberacaoStore.load(clienteId), // o FATO real (PC-R3)
    config: {
      estimativaDias,
      whatsapp: officialNumber,
    },
  });

  // ── PC-R4 · CONTINUIDADE DA RELAÇÃO: o pacote de FATOS do caso para a conversa.
  // Deriva da MESMA visão segura do Portal (teto do dizível). O link só existe se
  // o Portal já NASCEU (fato) — renovação é consequência da conversa, nunca fluxo.
  // Best-effort: qualquer falha ⇒ null; a conversa NUNCA quebra por causa dele.
  const casoFatos = async (chatId: string): Promise<string | null> => {
    try {
      const identity = await identityMap.load(chatId);
      const clienteId = identity?.clienteId ?? null;
      // GO-LIVE 9B — TRI-ESTADO com ausência declarada (Lei 9): o silêncio (null)
      // deixava o LLM livre para presumir um caso. Agora a ausência é um FATO.
      if (identity === null) return PACOTE_SEM_CASO; // nem identidade ⇒ nenhum caso
      if (clienteId === null || clienteId === identity.chatId) return PACOTE_CASO_EM_ABERTURA; // caso nasceu; fase inicial
      const visao = await acompanhamento.acompanhamento(clienteId);
      if (visao === null) return PACOTE_CASO_EM_ABERTURA;
      const liberado = await liberacaoStore.load(clienteId);
      const link =
        liberado !== null && clientePortalSecret !== ''
          ? `${config.publicUrl.replace(/\/+$/, '')}/portal?t=${emitirTokenCliente(clienteId, 90, clock.now(), clientePortalSecret)}`
          : null;
      return pacoteDeEstado(visao, link);
    } catch {
      return null;
    }
  };

  // ── LLM real (4 ports) e HTTP resiliente ─────────────────────────────────────
  const resilientHttp = new ResilientHttpClient(new FetchHttpClient(), sleeper, observability, clock, 'http');
  const llm = createLlmBundle({ config, http: resilientHttp, observability, clock });

  // ── CAT-02A: captura dos bytes reais de documentos (assíncrona, best-effort) ──
  // CAT-02B: referência messageId→sha256 e vínculo definitivo documentId→link
  // (reusam production.documents via JsonStore).
  const mediaReferences = new JsonMediaReferenceStore(json);
  const documentLinks = new JsonDocumentLinkStore(json);
  // CAT-02C: serve o conteúdo real do documento por documentId (uso interno, servidor admin).
  const documentContent = new DocumentContentService(documentLinks, mediaStore);
  // CAT-03A: transforma um documento em texto bruto (documentId → Vision → cache por sha256).
  // Apenas EXISTE e fica disponível em assembleProduction; ninguém o chama automaticamente.
  const documentReader = new DocumentReaderService({
    links: documentLinks,
    store: mediaStore,
    reader: new AnthropicVisionClient(resilientHttp, config.llm.anthropicApiKey, config.llm.anthropicModel),
    cache: new JsonDocumentTextCache(json),
    model: config.llm.anthropicModel,
    clock,
    log: (message) => observability.error('reading', 'document', clock.now(), message),
  });
  const mediaCapture = new MediaCaptureRuntime({
    // Cadeia: base64 embutido no evento / API da Evolution → download direto do
    // CDN do WhatsApp com descriptografia local (independe da Evolution persistir).
    gateway: new ChainedMediaGateway([
      new EvolutionMediaClient(resilientHttp, config.evolution),
      new DirectWhatsAppMediaClient(),
    ]),
    store: mediaStore,
    references: mediaReferences,
    log: (message) => observability.error('media', 'capture', clock.now(), message),
  });

  // ── Dispatcher (2A.2) ────────────────────────────────────────────────────────
  const registry = new SubscriberRegistry();
  const outbox = new OutboxRuntime({
    outbox: outboxStore,
    deliveries,
    idempotency,
    registry,
    retryPolicy: new ExponentialBackoffRetryPolicy({ baseMs: 1000, factor: 2, maxMs: 60_000, maxAttempts: 5, jitter: 0 }),
    clock,
  });

  // ── 2E: memória viva + administração (com narração/extração LLM injetadas) ───
  const living = assembleLivingMemory({
    clock,
    uuid,
    memoryStore,
    conversationStore,
    ...(llm.extractor ? { extractor: llm.extractor } : {}),
  });
  const administration = assembleAdministration({
    memoryStore,
    metricsStore,
    ...(llm.narration ? { narration: llm.narration } : {}),
    founder: { founderName: 'Jessé' },
    // GO-LIVE-03 (itens 4/5): fontes REAIS para o cérebro administrativo — a lista
    // única (status derivado) e os casos por advogado (staff + atribuições +
    // trabalho jurídico). Closures avaliadas por chamada (staff/work definidos
    // adiante nesta composição; invocados só em request-time).
    sources: {
      clientes: async () => (await clientes.list(clock.now())).map((c) => ({ status: c.status, quem: c.quem })),
      porAdvogado: async () => {
        const advogados = await staff.list('advogado');
        const out: Array<{ nome: string; casos: number; ultimaAtividadeAt: Date | null }> = [];
        for (const a of advogados) {
          const casos = (await work.myMissions(a.id)).length;
          const entries = await work.myEntries(a.id);
          const ultima = entries.reduce<Date | null>(
            (max, e) => (max === null || e.createdAt.getTime() > max.getTime() ? e.createdAt : max),
            null,
          );
          out.push({ nome: a.name, casos, ultimaAtividadeAt: ultima });
        }
        return out;
      },
    },
  });

  // ── 2F ───────────────────────────────────────────────────────────────────────
  const scheduler = new SchedulerRuntime(schedulerStore);
  const workflow = new WorkflowRuntime(progressStore, scheduler, undefined, observability);
  const notification = new NotificationRuntime(new RecordingNotificationChannel(), DEFAULT_NOTIFICATION_POLICY);
  const handoff = new HumanHandoffRuntime(handoffStore);
  registry.register(new SerializedSubscriber(new AdminProjectionSubscriber(metricsStore)), 1, clock.now());
  registry.register(new SerializedSubscriber(workflow), 1, clock.now());
  // CAT-02B: liga o vínculo definitivo ao reconhecer o documento (observa o evento).
  registry.register(new SerializedSubscriber(new DocumentLinkSubscriber(mediaReferences, documentLinks)), 1, clock.now());
  // RFC-0035-G: projeta o Estado de Decisão (hoje: truthEstablished) para o Brain.
  registry.register(new SerializedSubscriber(new DecisionStateProjectionSubscriber(decisionState)), 1, clock.now());

  // GO-LIVE 13A/11D: liga o encerramento real de missão ao feedback loop (11C). O
  // store alimenta o Command Center (insights cognitivos) e o painel do arquiteto.
  // Falha isolada: o subscriber jamais derruba o encerramento.
  const atendimentoStore = new InMemoryAtendimentoStore();
  const feedbackLoop = new ProductionFeedbackLoop(atendimentoStore);
  registry.register(
    new MissionClosureFeedbackSubscriber({ loop: feedbackLoop, resolver: defaultEncerramentoResolver, observability, uuid, clock }),
    1,
    clock.now(),
  );

  // ── 2C + 2D (catálogo de PRODUÇÃO = 2D + reengajamento 4C) ───────────────────
  const brainAssembly = assembleExecutiveBrain({ clock, uuid, rules: new InMemoryRuleCatalog(PRODUCTION_RULE_CATALOG) });
  const missionAssembly = assembleMissionRuntime({ eventStore, hasher, uuid, clock, identityMap });

  // GO-LIVE 15C-1 (Workflow 2): read model persistente + runtime das solicitações
  // complementares. Eventos de domínio publicados no Event Store (auditoria).
  const documentRequestStore = new JsonDocumentRequestStore(json);
  const documentRequests = new DocumentRequestRuntime(documentRequestStore, {
    publicar: async (requestId, events, estado) => {
      await eventStore.append(
        'document-request',
        requestId,
        ANY_VERSION,
        events.map((e) => ({
          eventType: e.eventName,
          isRelevant: true,
          payload: {
            requestId,
            caseId: estado.caseId,
            clientId: estado.clientId,
            lawyerId: estado.lawyerId,
            documentName: estado.documentName,
            status: estado.status,
            priority: estado.priority,
            fulfilledBy: estado.fulfilledBy,
          },
          occurredAt: e.occurredAt,
          provenance: { actor: estado.requestedBy, decisionType: 'Solicitação Complementar (advogado)', fundamento: 'GO-LIVE 15C — Workflow 2', operationalRuleRef: 'DR-15C' },
        })),
        { actor: estado.requestedBy },
      );
    },
  });

  // RFC-0035-G: a fronteira respaldada pela projeção (Mission Runtime). GO-LIVE 15A:
  // a MESMA fonte alimenta o estado da missão na conversa (sem duplicar consulta).
  // GO-LIVE 15C (Decisão B): o snapshot é enriquecido com as solicitações
  // complementares — a conversa lê SÓ o snapshot (Single Source of Truth).
  const missionSnapshots = new DocumentRequestsAwareSnapshotAdapter(
    new ProjectionBackedMissionSnapshotAdapter(decisionState, identityMap),
    documentRequestStore,
  );

  const fullLoop = new FullLoopBrainAdapter({
    brain: brainAssembly.brain,
    rules: brainAssembly.rules,
    snapshots: missionSnapshots,
    mission: missionAssembly.runtime,
    outbox,
    notification,
    handoff,
    memoryIngestor: living.ingestor,
    noteWriter: living.noteWriter,
    observability,
    clock,
  });

  // ── Gateway REAL (Evolution) ou in-memory ────────────────────────────────────
  const evolutionConfigured =
    config.evolution.baseUrl !== '' && config.evolution.instance !== '' && config.evolution.apiKey !== '';
  const gateway =
    wiring.gateway ??
    (evolutionConfigured
      ? new EvolutionGateway(resilientHttp, { baseUrl: config.evolution.baseUrl, instance: config.evolution.instance, apiKey: config.evolution.apiKey }, clock)
      : new InMemoryConversationGateway(clock));

  // ── 2B: Conversa (peças públicas; handles retidos para a ponte 3B) ───────────
  const sessions = new SessionRuntime(sessionStore);
  const convMemory = new ConversationMemoryRuntime(conversationStore, clock, uuid);
  // PC-R4: o contexto de conversa carrega o pacote de FATOS do caso (best-effort).
  // GO-LIVE 15A: e o ESTADO da missão, derivado da MISSÃO ATIVA (Mission Runtime),
  // com o status do cliente como um dos sinais.
  // GO-LIVE 15C-3: e a PENDÊNCIA documental — derivada EXCLUSIVAMENTE do Mission
  // Snapshot (a conversa nunca consulta banco/read model).
  const pendenciaDocumental: PendenciaDocumentalProvider = async (chatId) => {
    const s = await missionSnapshots.load(chatId);
    const dr = s?.documentRequests;
    if (!dr || dr.totalPendentes === 0 || dr.ultimaSolicitacao === null) return null;
    return { total: dr.totalPendentes, documentName: dr.ultimaSolicitacao.documentName, requestedBy: dr.ultimaSolicitacao.requestedBy, prioridade: dr.prioridadeMaisAlta ?? 'normal' };
  };
  // Decreto "Jornada Documental Inicial" — a contabilidade canônica da Jornada 1:
  // classificação determinística sobre o texto TRANSCRITO pelo Reader; pendências
  // sincronizadas no ALIR (Readiness e nascimento enxergam a MESMA verdade).
  const onboardingDocumental = new OnboardingDocumentalRuntime({
    store: new JsonOnboardingDocumentalStore(json),
    leitor: { texto: (documentId) => documentReader.readById(documentId) },
    pendencias: { setPendingDocuments: (chatId, labels) => living.memory.setPendingDocuments(chatId, labels) },
  });
  const onboardingProvider: OnboardingDocumentalProvider = (chatId) => onboardingDocumental.visao(chatId);
  // JORNADA COMERCIAL (decreto 2026-07-20): a máquina de estados determinística
  // que governa o funil — fonte única da verdade (registro ns 'jornada' +
  // contabilidade documental). A LLM não decide nenhum passo do funil.
  const jornadaComercial = new JornadaComercialRuntime({
    json,
    onboarding: onboardingDocumental,
    observability,
    clock,
  });
  const context = new ConversationContextRuntime(
    sessions,
    convMemory,
    {},
    casoFatos,
    criarMissaoProvider(missionSnapshots, clientes, clock, onboardingDocumental),
    pendenciaDocumental,
    onboardingProvider,
  );

  // GO-LIVE 15C-3 · Parte 2 — ASSOCIAÇÃO INTELIGENTE: documento reconhecido no
  // caso ⇒ associa à solicitação (única/IA) ou pede confirmação ao cliente.
  registry.register(
    new DocumentArrivalSubscriber({ store: documentRequestStore, runtime: documentRequests, gateway, confirmacoes: json, observability, clock }),
    1,
    clock.now(),
  );
  // Decreto "Jornada Documental Inicial" — o subscriber que ALIMENTA a jornada:
  // mission.created semeia; document.recognized classifica (retry 2A.2 quando a
  // transcrição/vínculo ainda não está pronto). DEFEITO REAL de produção
  // corrigido aqui: o projector em memória nasce VAZIO a cada restart do
  // container e só era atualizado pelas rotas do painel — o primeiro HISCON
  // pós-deploy caía em "chat não resolvível" → 5 retries → DLQ → cliente
  // cobrado para sempre. O resolver agora se AUTO-ATUALIZA (refresh incremental
  // por globalSeq, barato) antes de desistir.
  registry.register(
    new OnboardingDocumentalSubscriber({
      runtime: onboardingDocumental,
      // Lazy: o projector é declarado adiante nesta montagem; o resolver só o
      // toca no momento do EVENTO (o registro do subscriber acontece antes).
      chatDaMissao: (missionId) => criarResolverDeChat(projector)(missionId),
      observability,
      clock,
      // SOLUÇÃO DEFINITIVA (4ª rodada): esperar a transcrição DENTRO do turno —
      // a AHRI só responde depois de ENXERGAR o documento. O drain processa o
      // lote em paralelo (o DocumentLinkSubscriber não é bloqueado pela espera).
      sleeper,
      // PROGRESSÃO AUTOMÁTICA (5ª rodada): "✅ Registrado: X! Agora: Y" —
      // autorada, sem LLM, gravada na memória da conversa (a AHRI fica ciente).
      comunicador: {
        enviar: async (chatId, texto) => {
          const receipt = await gateway.sendText(chatId, texto);
          await convMemory.recordOutbound(chatId, texto, receipt.providerMessageId);
        },
      },
      // 7ª rodada: registro DENTRO do turno ⇒ a resposta da jornada fala o
      // fato; o subscriber só envia a progressão TARDIA (marcador ativo).
      jornada: jornadaComercial,
    }),
    1,
    clock.now(),
  );
  const nomeDoCliente = async (chatId: string): Promise<string | null> => (await living.relationship.context(chatId)).knownName;
  // Decreto Tráfego Pago · B1 — anexo do advogado (procuração/contrato de
  // honorários) enviado ao cliente PARA ASSINAR. O enviador de documento é o
  // próprio gateway quando ele sabe enviar mídia (Evolution); in-memory ⇒ null
  // (anúncio segue só em texto, com observabilidade).
  const documentRequestAnexos = new JsonAnexoStore(json);
  const enviadorDeDocumento =
    typeof (gateway as Partial<EnviadorDeDocumento>).sendDocument === 'function' ? (gateway as unknown as EnviadorDeDocumento) : null;
  // GO-LIVE 15C-3 · Parte 3 — DISPARO PROATIVO: created → messaged → gateway.
  const documentRequestComunicador = new DocumentRequestComunicador({
    gateway,
    memory: convMemory,
    runtime: documentRequests,
    nomeDoCliente,
    observability,
    clock,
    anexos: documentRequestAnexos,
    documentos: enviadorDeDocumento,
  });
  // GO-LIVE 15C-4 · Partes 1 e 2 — AUTONOMIA: resolução da confirmação (no
  // inbound, mesma fila) + varredura de SLA (no tick temporal existente).
  const documentRequestAutonomia = new DocumentRequestAutonomia({
    store: documentRequestStore,
    runtime: documentRequests,
    gateway,
    confirmacoes: json,
    nomeDoCliente,
    observability,
    clock,
  });
  // GO-LIVE 15C-4 · Parte 3 — ENTREGA ao advogado (received → canal → WhatsApp),
  // com dedup por evento e registro entregue/falhou/sem-canal.
  const notificationChannels = new JsonNotificationChannelStore(json);
  registry.register(
    new LawyerNotifierSubscriber({ store: documentRequestStore, canais: notificationChannels, gateway, entregas: json, nomeDoCliente, observability, clock }),
    1,
    clock.now(),
  );
  const promptBuilder = new PromptBuilderRuntime(policy.antiRepetitionWindow);
  const timing = new HumanLikeTimingRuntime(policy, Math.random);
  const delay = new DelayRuntime(sleeper);
  const presence = new PresenceRuntime(gateway, sessions);
  const typing = new TypingRuntime(presence, delay);
  const queue = new MessageQueueRuntime(new InMemoryMessageQueueStore(), clock, uuid);
  const delivery = new DeliveryRuntime({ gateway, timing, typing, delay, presence, queue, sessions, memory: convMemory, clock, policy });
  const conversation = new ConversationRuntimeClass({
    perception: llm.perception,
    // Decreto 2026-07-20: enquanto a Jornada Comercial está ativa, a resposta é
    // AUTORADA pelo Journey Runtime (determinística); concluída ⇒ LLM normal.
    expression: new JourneyGovernedExpression(jornadaComercial, llm.expression),
    brain: fullLoop,
    gateway,
    sessions,
    memory: convMemory,
    context,
    promptBuilder,
    queue,
    delivery,
    silence: new SilenceDetectionRuntime(policy),
    clock,
    uuid,
    policy,
  });

  // ── 3A/3B/3D ─────────────────────────────────────────────────────────────────
  const projector = new TimelineProjector(eventStore);
  const staff = new StaffDirectoryRuntime(staffStore, handoff, clock, uuid);
  const work = new AdvogadoWorkRuntime(assignmentStore, juridicalStore, clock, uuid);
  const bridge = new AdvogadoAhriBridge({
    brain: brainAssembly.brain,
    rules: ADVOGADO_RULE_CATALOG,
    messenger: new ConversationClientMessenger({
      memory: convMemory,
      context,
      promptBuilder,
      expression: llm.expression,
      queue,
      delivery,
      policy,
      clock,
    }),
    clock,
    chatOf: (missionId) => projector.missions().find((m) => m.missionId === missionId)?.chatId ?? null,
  });

  const auditor = new EventStoreIntegrityAuditor(eventStore, hasher);

  // ── GO LIVE B · B-R2: visão do Perito (fila derivada + contratos + planilha) ──
  // Deps são funções simples sobre componentes JÁ existentes: projector (documentos
  // reconhecidos por missão, com refresh) e DocumentReader (texto cacheado).
  const perito = new PeritoView({
    clientes,
    documentosDaMissao: async (missionId) => {
      await projector.refresh();
      return projector.allDocuments().filter((d) => d.missionId === missionId).map((d) => d.documentId);
    },
    textoDoDocumento: (documentId) => documentReader.readById(documentId),
    exporter: new CsvPlanilhaExporter(),
  });

  // ── PORTAL DO CLIENTE · PC-R3: o NASCIMENTO (varredura sem clique humano) ─────
  // Brain decide (RO-CADASTRO-CONCLUIDO); fato liberacao-portal ANTES da mensagem
  // (envio único, Lei 8); entrega pelo pipeline canônico com cadência humana.
  const nascimento = new NascimentoPortalRuntime({
    clientes,
    memory: memoryStore,
    liberacao: liberacaoStore,
    comunicador: new BrainNascimentoComunicador({
      brain: brainAssembly.brain,
      memory: convMemory,
      context,
      queue,
      delivery,
      observability,
      clock,
      uuid: () => uuid.next(),
    }),
    config: {
      estimativaDias,
      validadeLinkDias: 90,
      publicUrl: config.publicUrl,
      tokenSecret: clientePortalSecret,
    },
  });

  // ── GO-LIVE-02 · A DESPEDIDA (Modelo A) — espelho do nascimento ──────────────
  // Fato despedida ANTES da mensagem (Lei 8); Brain decide (RO-ETAPA-CONCLUIDA);
  // texto homologado; entrega pelo pipeline canônico com cadência humana.
  const despedida = new DespedidaRuntime({
    clientes,
    despedida: despedidaStore,
    comunicador: new BrainDespedidaComunicador({
      brain: brainAssembly.brain,
      memory: convMemory,
      context,
      queue,
      delivery,
      observability,
      clock,
    }),
  });

  // ── GO-LIVE-02 · TRADUÇÃO HUMANIZADA — a verdade permanece; a linguagem muda ─
  // Original = fato (Lei 10); textoCliente gerado UMA vez na escrita; fail-closed
  // (sem tradução ⇒ Portal não mostra); o tick reprocessa pendentes.
  const llmCompletion = llm.completion;
  const traducao = new TraducaoClienteRuntime(
    juridicalStore,
    llmCompletion === null
      ? null
      : { traduzir: async (original: string) => (await llmCompletion.complete(PROMPT_TRADUCAO_CLIENTE, original)).text },
    async () =>
      (await clientes.list(clock.now()))
        .map((c) => c.missionId)
        .filter((m): m is string => m !== null),
    (message) => observability.error('traducao', 'cliente', clock.now(), message),
  );

  // ── Visões estruturais para os servidores CONGELADOS ─────────────────────────
  // Nota: os servidores 3A/3B/3D nunca usam `eventStore` da visão (apenas read
  // models); o campo é tipado concretamente por herança histórica — cast declarado.
  const eventStoreView = eventStore as InMemoryEventStore;

  const advogadoView: AssembledAdvogadoOperation = {
    conversation,
    gateway,
    eventStore: eventStoreView,
    projector,
    work,
    bridge,
    staff,
    handoff,
    observability,
    memoryStore,
    metricsStore,
    workflow,
    documentContent,
    traducao, // GO-LIVE-02: o servidor do advogado traduz na escrita
    // GO-LIVE-04: Auth Runtime compartilhado — provider do advogado (convite→
    // senha individual→login). O segredo que assina convites é o MESMO segredo
    // de acesso do portal (nada novo); credenciais persistidas com hash scrypt.
    auth: new AdvogadoAuthRuntime({
      staff: staffStore,
      credenciais: new JsonCredenciaisAdvogadoStore(json),
      secret: env['ADVOGADO_ACCESS_SECRET'] ?? '',
    }),
    // GO-LIVE 15C (Workflow 2): o advogado administra as solicitações pela API.
    documentRequests,
    documentRequestStore,
    documentRequestComunicador,
    // Decreto Tráfego Pago: anexo p/ assinatura (B1) + canal do advogado (B2)
    // + lista de clientes (painel admin "Clientes prontos p/ Advogado").
    documentRequestAnexos,
    notificationChannels,
    clientes,
  };

  // ── Conexão WhatsApp (Portal Admin) — administração de instâncias Evolution ───
  // Chave GLOBAL só backend (nunca ao browser/logs/resposta). Número oficial valida
  // o ownerJid. Config confirmada é PERSISTIDA (configStore) e aplicada no restart.
  const whatsapp = new WhatsAppConnectionRuntime({
    client: new EvolutionInstanceClient(new FetchEvoHttp(), {
      baseUrl: config.evolution.baseUrl,
      globalApiKey: env['EVOLUTION_GLOBAL_API_KEY'] ?? '',
    }),
    configStore,
    observability,
    clock,
    officialNumber,
    active: {
      instance: config.evolution.instance,
      number: (config.evolution.whatsappNumber ?? '').replace(/\D/g, ''),
    },
    webhookUrl: `${config.publicUrl.replace(/\/+$/, '')}/webhook/evolution`,
    webhookSecret: env['WEBHOOK_SECRET'] ?? config.evolution.apiKey,
    // GO-LIVE-03 (item 6): pré-condições declaradas — a tela sabe O QUE falta.
    management: {
      hasGlobalKey: (env['EVOLUTION_GLOBAL_API_KEY'] ?? '') !== '',
      hasFounderGate: (env['FOUNDER_ACCESS_SECRET'] ?? '') !== '',
    },
    // GO-LIVE-05 (BUG 2): sondas do diagnóstico — banco (toca o Postgres via
    // configStore) e filas (outbox). Best-effort; nunca alteram estado.
    diagnostics: {
      baseUrl: config.evolution.baseUrl,
      db: async () => { await configStore.load(); },
      queue: async () => (await deliveries.countByStatus()).pending,
    },
  });

  const boot = new BootRuntime(health, observability, clock);
  const adminView: AssembledAdminOperation = {
    conversation,
    mission: missionAssembly.runtime,
    atendimentoStore,
    outbox,
    workflow,
    scheduler,
    temporal: new TemporalSignalDispatcher(scheduler, conversation),
    notification,
    handoff,
    portals: new PortalIntegrationRuntime(metricsStore, handoff, progressStore, health),
    health,
    observability,
    boot,
    checklist: new GoLiveChecklist(clock),
    gateway,
    eventStore: eventStoreView,
    conversationStore,
    memoryStore,
    relationship: living.relationship,
    metricsStore,
    admin: administration.admin,
    founderConsole: administration.founderConsole,
    progressStore,
    projector,
    staff,
    auditor,
    documentContent,
    // B4.4: read models já existentes para as métricas operacionais (mesma instância).
    decisionState,
    work,
    // Conexão WhatsApp (Portal Admin).
    whatsapp,
    // GO LIVE A · R2/R3: lista única (derivada) + marcador modalidade + registro de venda.
    clientes,
    modalidadeStore,
    vendaStore,
    // GO LIVE B · B-R2/B-R3: visão do Perito + o fato "pedidos administrativos".
    perito,
    pedidosStore,
  };

  const cursor = new CursorRuntime(cursorStore);
  const gate = new DecisionGateRuntime(decisionStore, clock, uuid);
  const productivity = new ProductivityRuntime(productivityStore);
  const lxView: AssembledLawyerExperience = {
    op: advogadoView,
    cursor,
    gate,
    nightShift: new NightShiftRuntime(advogadoView, gate, productivity),
    afterDecision: new AfterDecisionRuntime(advogadoView, gate, productivity, clock),
    plantao: new PlantaoService(advogadoView, cursor, gate, productivity, clock),
    productivity,
  };

  // ── Boot components (produção) ───────────────────────────────────────────────
  const component = (name: string, dependsOn: readonly string[], probe: () => Promise<void>): BootableComponent => ({
    name,
    dependsOn,
    start: probe,
    check: () => Promise.resolve(online(name, clock.now())),
  });
  const bootComponents: readonly BootableComponent[] = [
    component('storage', [], async () => {
      await json.keys('config');
    }),
    component('event-store', ['storage'], async () => {
      await eventStore.streamVersion('probe', '00000000-0000-4000-8000-0000000000ff');
    }),
    component('dispatcher', ['event-store'], () =>
      registry.all().length >= 2 ? Promise.resolve() : Promise.reject(new Error('subscribers ausentes')),
    ),
    component('brain', [], async () => {
      if ((await brainAssembly.rules.all()).length === 0) throw new Error('catálogo vazio');
    }),
    component('mission', ['event-store', 'brain'], () => Promise.resolve()),
    component('memory', ['storage'], async () => {
      await memoryStore.all();
    }),
    component('scheduler', ['storage'], async () => {
      await scheduler.pendingCount();
    }),
    component('workflow', ['dispatcher', 'scheduler'], () => Promise.resolve()),
    component('llm', [], () => Promise.resolve()),
    component('gateway', [], async () => {
      await gateway.setPresence('00000000-boot-probe', 'available');
    }),
    component('conversation', ['brain', 'memory', 'gateway'], () => Promise.resolve()),
    component('portals', ['memory'], () => Promise.resolve()),
  ];

  // ── SHADOW MODE (4D): recorder envolvendo a entrada única; ativo por flag ────
  const shadowMode = (env['SHADOW_MODE'] ?? 'true') !== 'false';
  const shadowStore = new JsonShadowStore(json);
  const plainIngress = new ProductionIngress(
    conversation,
    scheduler,
    (missionId) => projector.missions().find((m) => m.missionId === missionId)?.chatId ?? null,
    // B4.2: recorrência CONTROLADA sobre o MESMO scheduler (sem novo scheduler/persistência).
    new FollowUpRecurrenceRuntime(scheduler),
    // Pré-hook COMPOSTO (mesma fila serializada): a captura DETERMINÍSTICA da
    // Jornada Comercial (nome/cidade/consentimento — decreto 2026-07-20) roda
    // ANTES da autonomia do DocumentRequest (15C-4); a varredura de SLA segue.
    {
      aoReceberTexto: async (chatId, texto, now) => {
        await jornadaComercial.aoReceberTexto(chatId, texto, now);
        await documentRequestAutonomia.aoReceberTexto(chatId, texto, now);
      },
      varredura: (now) => documentRequestAutonomia.varredura(now),
    },
  );
  const shadow = new ShadowRecorder(
    plainIngress,
    shadowStore,
    {
      missionsOf: (chatId) => projector.missionsOf(chatId),
      timelineCounts: (missionId) => {
        const t = projector.missionTimeline(missionId);
        const count = (type: string): number => t.filter((e) => e.streamType === type).length;
        return { truth: count('operational-truth'), state: count('operational-state'), stage: count('operational-stage') };
      },
      workflowSteps: async (missionId) => (await progressStore.load(missionId))?.steps ?? [],
      turnCount: async (chatId) => (await memoryStore.load(chatId))?.messageCount ?? null,
      refreshProjector: () => projector.refresh(),
    },
    llm.meter,
    clock,
    uuid,
    () => shadowMode,
  );

  return {
    ingress: shadowMode ? shadow : plainIngress,
    shadow,
    shadowStore,
    shadowMode,
    mode: {
      storage: databaseUrl !== null ? 'postgres' : 'memory',
      gateway: wiring.gateway ? 'memory' : evolutionConfigured ? 'evolution' : 'memory',
      llm: llm.provider,
    },
    config,
    configStore,
    conversation,
    gateway,
    adminView,
    advogadoView,
    lxView,
    health,
    observability,
    boot,
    bootComponents,
    scheduler,
    temporal: adminView.temporal,
    outbox,
    memoryStore,
    metricsStore,
    llm,
    databaseUrl,
    mediaCapture,
    documentReader,
    alir,
    acompanhamento,
    nascimento,
    despedida,
    traducao,
  };
}

export const PRODUCTION_DEFAULTS = DEFAULT_PRODUCTION_CONFIG;
