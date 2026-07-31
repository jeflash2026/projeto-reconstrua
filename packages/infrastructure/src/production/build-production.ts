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
  SocioAuthRuntime,
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
  contratosDaJanela,
  interpretarInteresse,
  type ClienteElegivel,
  type InboundEnvelope,
  ufDoTelefone,
} from '@reconstrua/application';
import type { BootableComponent } from '@reconstrua/application';
import {
  MissionClosureFeedbackSubscriber,
  defaultEncerramentoResolver,
} from '../pipeline/mission-closure-feedback-subscriber.js';
import { JsonDocumentRequestStore } from '../document-request/json-document-request-store.js';
import { DocumentRequestsAwareSnapshotAdapter } from '../document-request/document-requests-snapshot-adapter.js';
import { DocumentArrivalSubscriber } from '../document-request/document-arrival-subscriber.js';
import { DocumentRequestComunicador } from '../document-request/document-request-comunicador.js';
import { DocumentRequestAutonomia } from '../document-request/autonomia.js';
import {
  JsonNotificationChannelStore,
  LawyerNotifierSubscriber,
} from '../document-request/lawyer-notifier.js';
import { JsonAnexoStore } from '../document-request/json-anexo-store.js';
import { JsonOnboardingDocumentalStore } from '../onboarding/json-onboarding-store.js';
import { JornadaComercialRuntime } from '../jornada/jornada-runtime.js';
import { JourneyGovernedExpression } from '../jornada/journey-governed-expression.js';
import {
  OnboardingDocumentalSubscriber,
  criarResolverDeChat,
} from '../onboarding/onboarding-documental-subscriber.js';
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
  CanalDoChatStore,
  FetchMetaHttp,
  MetaCanalRuntime,
  MetaCloudGateway,
  MetaGatewayRouter,
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
  JsonParecerStore,
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
import {
  AnthropicVisionClient,
  DocumentReaderService,
  JsonDocumentTextCache,
  LocalFirstDocumentReader,
  PdfTextExtractor,
} from '../reading/index.js';
import { PericiaService, ReleituraComparativa, RevinculoHiscon } from '../pericia/index.js';
import { JarvisRuntime } from '../administration/jarvis-runtime.js';
import { WebchatGatewayRouter, ehChatWeb } from '../webchat/webchat-gateway-router.js';
import { WebchatRuntime } from '../webchat/webchat-runtime.js';
import { DocsEquipeService } from '../docs-equipe/docs-equipe-service.js';
import { PericiaFluxoService } from '../pericia-fluxo/index.js';
import { MapaClientesService } from '../mapa-clientes/index.js';
import { CustodiaService, JsonCasoStore, PericiaDigitalService } from '../pericia-digital/index.js';
import { JsonSocioStore, JsonSocioCredenciaisStore, SociosService } from '../socios/index.js';
import { MedidorDeCusto } from '../custos/index.js';
import { ReaquecimentoService } from '../reaquecimento/index.js';
import {
  EvolutionInstanceClient,
  FetchEvoHttp,
  WhatsAppConnectionRuntime,
} from '../whatsapp-connection/index.js';

export interface ProductionWiring {
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Overrides de teste (gateway/sleeper/config). */
  readonly gateway?: ConversationGateway;
  readonly sleeper?: Sleeper;
  readonly config?: ProductionConfig;
  /** DECRETO 2026-07-30 (ban da Meta por "spam"): mensagens PROATIVAS
   *  automáticas ao cliente DESLIGADAS por padrão (follow-ups do tick,
   *  lembretes de SLA, retomada, CPF 09:00). A AHRI só fala quando o cliente
   *  fala, ou quando o DONO manda (admin/Jarvis). true = SÓ para testes do
   *  maquinário temporal. */
  readonly followUpsAutomaticos?: boolean;
}

export interface AssembledProduction {
  /** ENTRADA ÚNICA de produção (A2/4C): turnos serializados por conversa.
   *  Em SHADOW_MODE (4D), é o ShadowRecorder envolvendo a mesma entrada. */
  readonly ingress: TurnIngress;
  /** Shadow Mode (4D): recorder + store de reports (sempre montados; ativo por flag). */
  readonly shadow: ShadowRecorder;
  readonly shadowStore: ShadowStore;
  readonly shadowMode: boolean;
  readonly mode: {
    readonly storage: 'postgres' | 'memory';
    readonly gateway: 'evolution' | 'memory';
    readonly llm: string;
  };
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
  /** Decreto 2026-07-30: o WEBCHAT da AHRI — canal próprio, mesmo fluxo do
   *  WhatsApp (mesma entrada única, mesmo media store, mesma memória). */
  readonly webchat: WebchatRuntime;
  /** Decreto 2026-07-31: o canal OFICIAL (Meta Cloud API) — null quando as
   *  envs META_WHATSAPP_TOKEN/META_PHONE_NUMBER_ID não estão configuradas. */
  readonly metaCanal: MetaCanalRuntime | null;
  /** Decreto 2026-07-31: o CANAL do último contato do chat (aba Conversa do
   *  Painel Admin) — 'meta' | 'evolution' | 'webchat'. */
  readonly canalDoChat: (chatId: string) => Promise<'meta' | 'evolution' | 'webchat'>;
  /** DEPLOY GRACIOSO (caso Iracema, 2026-07-31): espera os turnos EM VOO
   *  terminarem (com teto) antes de o processo morrer — restart nunca mais
   *  engole a resposta de um cliente. */
  readonly drenarTurnos: (timeoutMs: number) => Promise<void>;
  /** Decreto 2026-07-30: docs da FASE 2 humana (procuração/RG/comprovante)
   *  anexados pelo time no Painel Admin — mesmo media store do WhatsApp. */
  readonly docsEquipe: DocsEquipeService;
  /** Decreto Dossiê Pericial: visão do PERITO (HISCON→contratos/migrados/indícios). */
  readonly pericia: PericiaService;
  /** Decreto 2026-07-27: relatório V2 × leitura atual (só leitura, nada grava). */
  readonly releitura: ReleituraComparativa;
  /** Decreto 2026-07-27 (caso Roberto): religar o CNIS ao anexo CERTO da conversa. */
  readonly revinculo: RevinculoHiscon;
  /** Decreto 2026-07-29: o JARVIS do Founder Console — conhecimento total dos
   *  Read Models + distribuição de contratos p/ advogado com confirmação. */
  readonly jarvis: JarvisRuntime;
  /** Decreto 2026-07-24: fluxo do perito (em perícia/10 dias, credenciais, resposta do banco). */
  readonly periciaFluxo: PericiaFluxoService;
  /** Decreto 2026-07-24: Central de Perícia Digital (atrás de feature flag). */
  readonly periciaDigital: PericiaDigitalService;
  readonly periciaDigitalHabilitado: boolean;
  /** Decreto 2026-07-24: mapa de clientes (distribuição por estado/cidade). */
  readonly mapaClientes: MapaClientesService;
  /** Decreto 2026-07-21: convite→senha própria→login do PERITO (Auth Runtime, papel 'perito'). */
  readonly peritoAuth: AdvogadoAuthRuntime;
  /** Onda 2 (2026-07-31): convite→senha→login do ATENDIMENTO HUMANIZADO
   *  (papel 'operador' — a secretária da fase 2). */
  readonly humanizadoAuth: AdvogadoAuthRuntime;
  /** Onda 3 (2026-07-31): o PARECER EM LOTE do Admin — pendentes da base
   *  legada + envio unitário com claim (fato antes da mensagem). */
  readonly parecerLote: {
    pendentes(): Promise<
      readonly { clienteId: string; chatId: string; nome: string; contratos: number }[]
    >;
    enviar(clienteId: string): Promise<{ ok: boolean; motivo?: string }>;
  };
  /** Onda 2 (2026-07-31): a mesa do humanizado — clientes que CONFIRMARAM o
   *  parecer (cadastro gerado) + status dos 3 documentos da fase 2, com a UF
   *  (organização por estado) e a marcação "aguardando devolução assinada". */
  readonly humanizado: {
    clientes(): Promise<
      readonly {
        clienteId: string;
        chatId: string;
        nome: string;
        telefone: string;
        uf: string;
        confirmadoEm: string;
        docs: { procuracao: boolean; rg: boolean; comprovante: boolean };
        completo: boolean;
        aguardandoAssinatura: boolean;
      }[]
    >;
    marcarAguardando(chatId: string, valor: boolean): Promise<void>;
  };
  /** Decreto 2026-07-23: rateio do potencial + cadastro/painel do SÓCIO (login por CPF). */
  readonly socios: SociosService;
  /** Decreto 2026-07-23: convite (link) → CPF+senha → login do SÓCIO. */
  readonly socioAuth: SocioAuthRuntime;
  /** CAT-03A: transforma um documento em texto bruto (disponível; sem gatilho automático). */
  readonly documentReader: DocumentReaderService;
  /** Medidor de Custo (2026-07-21): registros de gasto de IA por conversa/leitura. */
  readonly custos: MedidorDeCusto;
  /** Decreto 2026-07-22: reaquecimento de leads frios — autorizado pelo admin. */
  readonly reaquecimento: ReaquecimentoService;
  /** Decreto 2026-07-26: a jornada comercial — fonte do CPF exibido no cadastro. */
  readonly jornadaComercial: JornadaComercialRuntime;
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
    // Nome REAL do beneficiário do HISCON prevalece sobre o capturado na conversa
    // (que às vezes é a cidade). `pericia` é definido adiante; o closure só o acessa
    // em runtime (na montagem da lista), quando tudo já está inicializado.
    nomeAutoritativo: (chatId) => pericia.nomeDoHiscon(chatId),
  });

  // ── PORTAL DO CLIENTE · PC-R1/R3/R4: a projeção segura ÚNICA (Portal + AHRI) ──
  // D1: PROCESSING_ESTIMATE_DAYS lida AQUI, em um único ponto — Portal e mensagens
  // da AHRI consomem o MESMO valor. D3: a visão só compõe; nada nasce nela.
  // Decreto 2026-07-31: o número OFICIAL da empresa agora é o do canal Meta
  // Cloud API (+55 16 99636-9934) — é ele que aparece em CTA/Portal/landing.
  const officialNumber = (env['OFFICIAL_WHATSAPP_NUMBER'] ?? '5516996369934').replace(/\D/g, '');
  const estimativaDias = Number(env['PROCESSING_ESTIMATE_DAYS'] ?? '12');
  const clientePortalSecret = env['CLIENTE_PORTAL_SECRET'] ?? '';
  const liberacaoStore = new JsonLiberacaoPortalStore(json);
  // Onda 1/3 (2026-07-31): o fato do PARECER (enviado + confirmado) — instância
  // ÚNICA compartilhada por nascimento, mesa do humanizado e lote do Admin.
  const parecerStore = new JsonParecerStore(json);
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
    // 15ª rodada — rótulos HUMANOS no Portal ("RG (frente e verso)" em vez de
    // "documento 3e77f2a2"). Lazy: onboardingDocumental é declarado adiante
    // nesta montagem; a closure só o toca em request-time.
    rotulosDocumentais: async (chatId) => {
      const v = await onboardingDocumental.visao(chatId);
      if (v === null || v.recebidos.length === 0) return null;
      const FACE_RG = 'RG (uma das faces)';
      const faces = v.recebidos.filter((r) => r === FACE_RG).length;
      const rg = faces >= 2 ? ['RG (frente e verso)'] : faces === 1 ? [FACE_RG] : [];
      const demais = v.recebidos.filter((r, i, a) => r !== FACE_RG && a.indexOf(r) === i);
      return [...rg, ...demais];
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
  const resilientHttp = new ResilientHttpClient(
    new FetchHttpClient(),
    sleeper,
    observability,
    clock,
    'http',
  );
  // Medidor de Custo (2026-07-21): observa TODO gasto de IA — conversa (por
  // turno/chatId via Ingress) e leitura de documentos (por documentId). Só
  // registra; nunca decide nem bloqueia.
  const custos = new MedidorDeCusto({ json, clock });
  const llm = createLlmBundle({ config, http: resilientHttp, observability, clock, custo: custos });

  // ── CAT-02A: captura dos bytes reais de documentos (assíncrona, best-effort) ──
  // CAT-02B: referência messageId→sha256 e vínculo definitivo documentId→link
  // (reusam production.documents via JsonStore).
  const mediaReferences = new JsonMediaReferenceStore(json);
  const documentLinks = new JsonDocumentLinkStore(json);
  // CAT-02C: serve o conteúdo real do documento por documentId (uso interno, servidor admin).
  const documentContent = new DocumentContentService(documentLinks, mediaStore);
  // CAT-03A + Economia da Leitura (2026-07-22): documentId → TEXTO, cache por
  // sha256. A cadeia LOCAL-PRIMEIRO extrai o texto embutido do PDF (HISCON do
  // Meu INSS é nativo) de graça e local; só cai na Vision para foto/PDF
  // escaneado. Texto jurídico: extração mecânica NUNCA inventa contrato.
  const textCache = new JsonDocumentTextCache(json);
  const documentReader = new DocumentReaderService({
    links: documentLinks,
    store: mediaStore,
    reader: new LocalFirstDocumentReader({
      extractor: new PdfTextExtractor(),
      vision: new AnthropicVisionClient(
        resilientHttp,
        config.llm.anthropicApiKey,
        config.llm.anthropicModel,
      ),
      // TRAVA DE QUALIDADE do HISCON: se o texto local é um HISCON (tem o
      // cabeçalho) mas PERDEU os blocos "CONTRATO:" (colunas embaralhadas na
      // extração local), reprova ⇒ Vision. Outros documentos: confia no local.
      validarLocal: (texto) =>
        !/HIST[ÓO]RICO DE\s+EMPR[ÉE]STIMO CONSIGNADO/i.test(texto) || /^CONTRATO\s*:/im.test(texto),
      log: (message) => observability.event('reading', message, clock.now()),
    }),
    cache: textCache,
    model: config.llm.anthropicModel,
    clock,
    log: (message) => observability.error('reading', 'document', clock.now(), message),
    custo: custos,
  });
  // Decreto Dossiê Pericial (2026-07-21): a visão do PERITO montada do HISCON
  // transcrito — contratos por banco, migrados (sem pedido administrativo) e
  // indícios de estratégia. Nada decide; a destinação a advogado é MANUAL.
  // Decreto 2026-07-21: convite→senha própria→login TAMBÉM para o PERITO (o
  // mesmo Auth Runtime, papel 'perito'; convites assinados pelo segredo do
  // Admin — quem os emite; credenciais no MESMO store, ids são únicos).
  const peritoAuth = new AdvogadoAuthRuntime({
    staff: staffStore,
    credenciais: new JsonCredenciaisAdvogadoStore(json),
    secret: env['ADMIN_ACCESS_SECRET'] ?? '',
    role: 'perito',
    usoConvite: 'convite-perito',
  });

  // Onda 2 (decreto 2026-07-31): convite→senha própria→login TAMBÉM para o
  // ATENDIMENTO HUMANIZADO (papel 'operador' — a secretária). Mesmo Auth
  // Runtime; credenciais no MESMO store (ids são únicos).
  const humanizadoAuth = new AdvogadoAuthRuntime({
    staff: staffStore,
    credenciais: new JsonCredenciaisAdvogadoStore(json),
    secret: env['ADMIN_ACCESS_SECRET'] ?? '',
    role: 'operador',
    usoConvite: 'convite-operador',
  });

  // Releitura comparativa (decreto 2026-07-27): valida o leitor posicional V2
  // contra a base real — SÓ LEITURA, nunca toca no document-text cache.
  const releitura = new ReleituraComparativa({
    json,
    links: documentLinks,
    media: mediaStore,
    cache: textCache,
    clock,
  });

  // Revínculo do HISCON (decreto 2026-07-27, caso Roberto): quando o CNIS
  // registrado aponta ao anexo ERRADO, acha o PDF certo na MESMA conversa e
  // religa — sempre por ato explícito do dono, com backup reversível.
  const revinculo = new RevinculoHiscon({
    json,
    links: documentLinks,
    media: mediaStore,
    cache: textCache,
    clock,
  });

  const pericia = new PericiaService({
    json,
    reader: documentReader,
    clock,
    tetoJurosMensal:
      env['PERICIA_TETO_JUROS_MENSAL'] !== undefined && env['PERICIA_TETO_JUROS_MENSAL'] !== ''
        ? Number(env['PERICIA_TETO_JUROS_MENSAL'])
        : null,
  });

  // Decreto 2026-07-23 (Painel de Sócios): identidade por CPF, cadastro pelo Admin,
  // link (convite→CPF+senha→login) e rateio do potencial recuperável de TODOS os
  // HISCON. A base do rateio é a MESMA fonte do Financeiro (pericia.potencialDeTodos)
  // — o sócio vê exatamente a carteira que o Centro de Comando enxerga.
  const socioStore = new JsonSocioStore(json);
  const socioCredenciais = new JsonSocioCredenciaisStore(json);
  const socioAuth = new SocioAuthRuntime({
    socios: socioStore,
    credenciais: socioCredenciais,
    secret: env['ADMIN_ACCESS_SECRET'] ?? '',
  });
  const socios = new SociosService({
    socios: socioStore,
    credenciais: socioCredenciais,
    clock,
    base: async () => {
      const p = await pericia.potencialDeTodos().catch(() => null);
      return { total: p?.total ?? 0, clientes: p?.porCliente.length ?? 0 };
    },
  });

  const mediaCapture = new MediaCaptureRuntime({
    // Cadeia: base64 embutido no evento / API da Evolution → download direto do
    // CDN do WhatsApp com descriptografia local (independe da Evolution persistir).
    gateway: new ChainedMediaGateway([
      new EvolutionMediaClient(resilientHttp, config.evolution, (message) =>
        observability.error('media', 'evolution', clock.now(), message),
      ),
      new DirectWhatsAppMediaClient(undefined, (message) =>
        observability.error('media', 'direct', clock.now(), message),
      ),
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
    retryPolicy: new ExponentialBackoffRetryPolicy({
      baseMs: 1000,
      factor: 2,
      maxMs: 60_000,
      maxAttempts: 5,
      jitter: 0,
    }),
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
      clientes: async () =>
        (await clientes.list(clock.now())).map((c) => ({ status: c.status, quem: c.quem })),
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
  const notification = new NotificationRuntime(
    new RecordingNotificationChannel(),
    DEFAULT_NOTIFICATION_POLICY,
  );
  const handoff = new HumanHandoffRuntime(handoffStore);
  registry.register(
    new SerializedSubscriber(new AdminProjectionSubscriber(metricsStore)),
    1,
    clock.now(),
  );
  registry.register(new SerializedSubscriber(workflow), 1, clock.now());
  // CAT-02B: liga o vínculo definitivo ao reconhecer o documento (observa o evento).
  registry.register(
    new SerializedSubscriber(new DocumentLinkSubscriber(mediaReferences, documentLinks)),
    1,
    clock.now(),
  );
  // RFC-0035-G: projeta o Estado de Decisão (hoje: truthEstablished) para o Brain.
  registry.register(
    new SerializedSubscriber(new DecisionStateProjectionSubscriber(decisionState)),
    1,
    clock.now(),
  );

  // GO-LIVE 13A/11D: liga o encerramento real de missão ao feedback loop (11C). O
  // store alimenta o Command Center (insights cognitivos) e o painel do arquiteto.
  // Falha isolada: o subscriber jamais derruba o encerramento.
  const atendimentoStore = new InMemoryAtendimentoStore();
  const feedbackLoop = new ProductionFeedbackLoop(atendimentoStore);
  registry.register(
    new MissionClosureFeedbackSubscriber({
      loop: feedbackLoop,
      resolver: defaultEncerramentoResolver,
      observability,
      uuid,
      clock,
    }),
    1,
    clock.now(),
  );

  // ── 2C + 2D (catálogo de PRODUÇÃO = 2D + reengajamento 4C) ───────────────────
  const brainAssembly = assembleExecutiveBrain({
    clock,
    uuid,
    rules: new InMemoryRuleCatalog(PRODUCTION_RULE_CATALOG),
  });
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
          provenance: {
            actor: estado.requestedBy,
            decisionType: 'Solicitação Complementar (advogado)',
            fundamento: 'GO-LIVE 15C — Workflow 2',
            operationalRuleRef: 'DR-15C',
          },
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
    config.evolution.baseUrl !== '' &&
    config.evolution.instance !== '' &&
    config.evolution.apiKey !== '';
  const gatewayInterno =
    wiring.gateway ??
    (evolutionConfigured
      ? // 15ª rodada — SEM retry cego em ENVIO de mensagem: o retry do
        // ResilientHttpClient reenviava mensagens que a Evolution JÁ tinha
        // aceitado (resposta lenta/5xx pós-envio) ⇒ cliente recebia 2×. Envio
        // não é idempotente; leituras (getBase64) continuam com o resiliente.
        new EvolutionGateway(
          new FetchHttpClient(),
          {
            baseUrl: config.evolution.baseUrl,
            instance: config.evolution.instance,
            apiKey: config.evolution.apiKey,
          },
          clock,
        )
      : new InMemoryConversationGateway(clock));
  // CANAL OFICIAL META (decreto 2026-07-31): quando META_WHATSAPP_TOKEN +
  // META_PHONE_NUMBER_ID estão no ambiente, chats registrados como 'meta' (o
  // cliente escreveu no número OFICIAL) respondem pela Meta Cloud API; todo o
  // resto segue intocado ao gateway interno. Os dois canais CONVIVEM.
  const metaToken = env['META_WHATSAPP_TOKEN'] ?? '';
  const metaPhoneNumberId = env['META_PHONE_NUMBER_ID'] ?? '';
  const canais = new CanalDoChatStore(json);
  const metaGateway =
    metaToken !== '' && metaPhoneNumberId !== ''
      ? new MetaCloudGateway(
          new FetchMetaHttp(),
          {
            token: metaToken,
            phoneNumberId: metaPhoneNumberId,
            graphVersion: env['META_GRAPH_VERSION'],
          },
          clock,
          (mensagem) => {
            observability.error('meta', 'gateway', clock.now(), mensagem);
          },
        )
      : null;
  const comCanalMeta =
    metaGateway === null
      ? gatewayInterno
      : new MetaGatewayRouter(gatewayInterno, metaGateway, canais);
  // WEBCHAT (decreto 2026-07-30): conversas `…@webchat` nunca vão à Evolution —
  // a resposta fica na memória da conversa e a página do webchat lê de lá.
  // Conversas de WhatsApp seguem intocadas ao gateway interno.
  const gateway = new WebchatGatewayRouter(comCanalMeta, clock);

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
    return {
      total: dr.totalPendentes,
      documentName: dr.ultimaSolicitacao.documentName,
      requestedBy: dr.ultimaSolicitacao.requestedBy,
      prioridade: dr.prioridadeMaisAlta ?? 'normal',
    };
  };
  // Decreto "Jornada Documental Inicial" — a contabilidade canônica da Jornada 1:
  // classificação determinística sobre o texto TRANSCRITO pelo Reader; pendências
  // sincronizadas no ALIR (Readiness e nascimento enxergam a MESMA verdade).
  const onboardingDocumental = new OnboardingDocumentalRuntime({
    store: new JsonOnboardingDocumentalStore(json),
    leitor: { texto: (documentId) => documentReader.readById(documentId) },
    pendencias: {
      setPendingDocuments: (chatId, labels) => living.memory.setPendingDocuments(chatId, labels),
    },
  });
  const onboardingProvider: OnboardingDocumentalProvider = (chatId) =>
    onboardingDocumental.visao(chatId);
  // JORNADA COMERCIAL (decreto 2026-07-20): a máquina de estados determinística
  // que governa o funil — fonte única da verdade (registro ns 'jornada' +
  // contabilidade documental). A LLM não decide nenhum passo do funil.
  const jornadaComercial = new JornadaComercialRuntime({
    json,
    onboarding: onboardingDocumental,
    observability,
    clock,
    // O HISCON já foi recebido segundo a LIVING-MEMORY (a mesma fonte que libera o
    // portal)? Se sim, o caso está concluído — a AHRI NUNCA re-pede o HISCON já
    // enviado, mesmo que o onboarding-documental tenha divergido (caso Maria Angela).
    casoConcluido: async (chatId) => {
      const memoria = await memoryStore.load(chatId).catch(() => null);
      return (memoria?.documentsSent ?? []).some((d) => /hiscon|consignad|cnis/i.test(d.label));
    },
  });
  // Decreto 2026-07-22: REAQUECIMENTO DE LEADS — lista os frios e executa o
  // reaquecimento AUTORIZADO pelo admin (nada automático). Mesmo canal das
  // mensagens automáticas: gateway + memória da conversa (a AHRI fica ciente).
  const reaquecimento = new ReaquecimentoService({
    json,
    jornada: jornadaComercial,
    enviar: async (chatId, texto) => {
      const receipt = await gateway.sendText(chatId, texto);
      await convMemory.recordOutbound(chatId, texto, receipt.providerMessageId);
    },
    clock,
    // RETOMADA AUTOMÁTICA: conversa caída = último registro relevante da
    // memória é INBOUND (o cliente falou e nós não) — minutos desde então.
    minutosSemResposta: async (chatId) => {
      const entradas = await convMemory.recent(chatId, 12);
      for (let i = entradas.length - 1; i >= 0; i -= 1) {
        const e = entradas[i];
        if (!e) continue;
        if (e.kind === 'outbound') return null; // já respondida
        if (e.kind === 'inbound') return (clock.now().getTime() - e.at.getTime()) / 60_000;
      }
      return null; // sem inbound registrado: nada a retomar
    },
    observability,
  });
  const context = new ConversationContextRuntime(
    sessions,
    convMemory,
    {},
    casoFatos,
    criarMissaoProvider(missionSnapshots, clientes, clock, onboardingDocumental),
    pendenciaDocumental,
    onboardingProvider,
    // Decreto 2026-07-27 (caso 51 9109-4367): o estado do CPF no contexto — a
    // conversa nunca mais nega o pedido de CPF feito pelo próprio sistema.
    async (chatId) => (await jornadaComercial.fatos(chatId)).registro.cpf !== null,
  );

  // GO-LIVE 15C-3 · Parte 2 — ASSOCIAÇÃO INTELIGENTE: documento reconhecido no
  // caso ⇒ associa à solicitação (única/IA) ou pede confirmação ao cliente.
  registry.register(
    new DocumentArrivalSubscriber({
      store: documentRequestStore,
      runtime: documentRequests,
      gateway,
      confirmacoes: json,
      observability,
      clock,
    }),
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
  const nomeDoCliente = async (chatId: string): Promise<string | null> =>
    (await living.relationship.context(chatId)).knownName;
  // Decreto Tráfego Pago · B1 — anexo do advogado (procuração/contrato de
  // honorários) enviado ao cliente PARA ASSINAR. O enviador de documento é o
  // próprio gateway quando ele sabe enviar mídia (Evolution); in-memory ⇒ null
  // (anúncio segue só em texto, com observabilidade).
  const documentRequestAnexos = new JsonAnexoStore(json);
  const enviadorDeDocumento =
    typeof (gateway as Partial<EnviadorDeDocumento>).sendDocument === 'function'
      ? (gateway as unknown as EnviadorDeDocumento)
      : null;
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
    new LawyerNotifierSubscriber({
      store: documentRequestStore,
      canais: notificationChannels,
      gateway,
      entregas: json,
      nomeDoCliente,
      observability,
      clock,
    }),
    1,
    clock.now(),
  );
  const promptBuilder = new PromptBuilderRuntime(policy.antiRepetitionWindow);
  const timing = new HumanLikeTimingRuntime(policy, Math.random);
  const delay = new DelayRuntime(sleeper);
  const presence = new PresenceRuntime(gateway, sessions);
  const typing = new TypingRuntime(presence, delay);
  const queue = new MessageQueueRuntime(new InMemoryMessageQueueStore(), clock, uuid);
  const delivery = new DeliveryRuntime({
    gateway,
    timing,
    typing,
    delay,
    presence,
    queue,
    sessions,
    memory: convMemory,
    clock,
    policy,
  });
  const conversation = new ConversationRuntimeClass({
    perception: llm.perception,
    // Decreto 2026-07-20: enquanto a Jornada Comercial está ativa, a resposta é
    // AUTORADA pelo Journey Runtime (determinística); concluída ⇒ LLM normal.
    // Humanização (decreto 2026-07-22): com LLM REAL, o roteiro autorado do
    // funil é REDITO com voz humana (fatos/pedidos intactos; fallback verbatim).
    expression: new JourneyGovernedExpression(
      jornadaComercial,
      llm.expression,
      llm.provider !== 'offline',
    ),
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
    chatOf: (missionId) =>
      projector.missions().find((m) => m.missionId === missionId)?.chatId ?? null,
  });

  const auditor = new EventStoreIntegrityAuditor(eventStore, hasher);

  // ── GO LIVE B · B-R2: visão do Perito (fila derivada + contratos + planilha) ──
  // Deps são funções simples sobre componentes JÁ existentes: projector (documentos
  // reconhecidos por missão, com refresh) e DocumentReader (texto cacheado).
  const perito = new PeritoView({
    clientes,
    documentosDaMissao: async (missionId) => {
      await projector.refresh();
      return projector
        .allDocuments()
        .filter((d) => d.missionId === missionId)
        .map((d) => d.documentId);
    },
    textoDoDocumento: (documentId) => documentReader.readById(documentId),
    exporter: new CsvPlanilhaExporter(),
    // Decreto 2026-07-27: a fila da perícia exige FASE 1 completa (CPF+HISCON).
    // Lê o registro da jornada direto (ns 'jornada') — sem dependência de ordem.
    cpfDe: async (chatId) => {
      const r = (await json.get('jornada', chatId)) as { cpf?: string | null } | null;
      return r?.cpf ?? null;
    },
  });

  // Decreto 2026-07-24: FLUXO DA PERÍCIA — o perito baixa o estudo ⇒ 10 dias
  // correndo; guarda credenciais + resposta do banco; vencido, vira "pronto p/
  // advogado" com as provas. Estado próprio (ns 'pericia-fluxo'), por chatId.
  const periciaFluxo = new PericiaFluxoService({ json, clock });

  // Decreto 2026-07-24 (Central de Perícia Digital) — atrás de FEATURE FLAG
  // (PERICIA_DIGITAL_ENABLED=true). Reusa o HISCON parseado da PericiaService.
  const periciaDigitalHabilitado = (env['PERICIA_DIGITAL_ENABLED'] ?? '').toLowerCase() === 'true';
  const periciaDigital = new PericiaDigitalService({
    casos: new JsonCasoStore(json),
    custodia: new CustodiaService({ json, clock, uuid }),
    clock,
    uuid,
    extrairHiscon: (chatId) => pericia.hisconDe(chatId),
  });

  // Decreto 2026-07-24: MAPA DE CLIENTES — distribuição por estado (DDD) + cidades.
  const mapaClientes = new MapaClientesService({ json });

  // ── PORTAL DO CLIENTE · PC-R3: o NASCIMENTO (varredura sem clique humano) ─────
  // Brain decide (RO-CADASTRO-CONCLUIDO); fato liberacao-portal ANTES da mensagem
  // (envio único, Lei 8); entrega pelo pipeline canônico com cadência humana.
  const nascimento = new NascimentoPortalRuntime({
    clientes,
    memory: memoryStore,
    liberacao: liberacaoStore,
    // Decreto 2026-07-31 (funil com confirmação): a fase 1 completa envia o
    // PARECER (dossiê + pedido de confirmação); o cadastro espera o SIM.
    parecer: parecerStore,
    resumoParecer: async (chatId) => {
      const d = await pericia.dossie(chatId).catch(() => null);
      if (d === null) return null;
      const contratos = d.porBanco.reduce((s, b) => s + b.contratos.length, 0);
      return { contratos, indicios: d.indicios.length };
    },
    // O SIM depois do parecer: um inbound de texto afirmativo (a MESMA régua
    // determinística do consentimento — interpretarInteresse).
    confirmouApos: async (chatId, desde) => {
      const entradas = await conversationStore.recent(chatId, 60);
      return entradas.some(
        (e) =>
          e.kind === 'inbound' &&
          e.text !== null &&
          new Date(e.at).getTime() > desde.getTime() &&
          interpretarInteresse(e.text) === 'sim',
      );
    },
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
      : {
          traduzir: async (original: string) =>
            (await llmCompletion.complete(PROMPT_TRADUCAO_CLIENTE, original)).text,
        },
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
    // Decreto 2026-07-31: o card valida o pareamento da INSTÂNCIA EVOLUTION —
    // o número esperado aqui é o da Evolution (WHATSAPP_NUMBER), NÃO o oficial
    // da empresa (que agora vive no canal Meta e nunca aparece num QR).
    officialNumber: (config.evolution.whatsappNumber ?? '').replace(/\D/g, '') || officialNumber,
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
      db: async () => {
        await configStore.load();
      },
      queue: async () => (await deliveries.countByStatus()).pending,
    },
  });

  // ── JARVIS DO FOUNDER CONSOLE (decreto 2026-07-29) — conhecimento total dos
  //    Read Models + distribuição de contratos para advogado COM confirmação.
  const jarvisCompletion = llm.completion;
  const jarvis = new JarvisRuntime({
    json,
    clock,
    narrar:
      jarvisCompletion !== null
        ? async (system, user) => (await jarvisCompletion.complete(system, user)).text
        : null,
    // Elegíveis = FASE 1 completa (CPF + HISCON legível) e AINDA SEM advogado,
    // com a contagem de contratos NA JANELA por situação (ativos primeiro).
    elegiveis: async () => {
      const [lista, comHiscon] = await Promise.all([clientes.list(), perito.todosComHiscon()]);
      const out: ClienteElegivel[] = [];
      for (const c of comHiscon) {
        if (!c.temCpf) continue;
        const missionId = lista.find((x) => x.chatId === c.chatId)?.missionId ?? null;
        if (missionId === null) continue;
        if ((await work.assignedTo(missionId).catch(() => null)) !== null) continue;
        const h = await pericia.hisconDe(c.chatId).catch(() => null);
        if (h === null) continue;
        const janela = contratosDaJanela(h.contratos, clock.now());
        const ativos = janela.filter((k) => /^ATIVO/i.test(k.situacao ?? '')).length;
        const suspensos = janela.filter((k) => /^SUSPENS/i.test(k.situacao ?? '')).length;
        // Decreto 2026-07-30: o PESO da distribuição conta lotes de 3 por banco.
        const porBanco: Record<string, number> = {};
        for (const k of janela) {
          const banco = (k.bancoNome ?? k.bancoCodigo ?? 'SEM BANCO').trim() || 'SEM BANCO';
          porBanco[banco] = (porBanco[banco] ?? 0) + 1;
        }
        out.push({
          chatId: c.chatId,
          missionId,
          nome: c.quem,
          ativos,
          suspensos,
          outros: janela.length - ativos - suspensos,
          porBanco,
        });
      }
      return out;
    },
    advogados: async () => {
      const advs = await staffStore.byRole('advogado');
      const out = [];
      for (const a of advs.filter((x) => x.active)) {
        out.push({
          id: a.id,
          name: a.name,
          casos: (await work.myMissions(a.id).catch(() => [])).length,
        });
      }
      return out;
    },
    dossier: async () => {
      const d: Record<string, unknown> = { geradoEm: clock.now().toISOString() };
      try {
        const lista = await clientes.list();
        d['clientesTotal'] = lista.length;
        const porStatus: Record<string, number> = {};
        for (const c of lista) porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;
        d['clientesPorStatus'] = porStatus;
      } catch {
        /* bloco indisponível não derruba o dossiê */
      }
      try {
        const comHiscon = await perito.todosComHiscon();
        const fase1 = comHiscon.filter((c) => c.temCpf);
        d['clientesComHisconLegivel'] = comHiscon.length;
        d['fase1CompletaCpfMaisHiscon'] = fase1.length;
        d['comHisconAindaSemCpf'] = comHiscon.length - fase1.length;
        d['contratosTotais'] = comHiscon.reduce((s, c) => s + c.totalContratos, 0);
      } catch {
        /* idem */
      }
      try {
        const advs = await staffStore.byRole('advogado');
        const carga = [];
        for (const a of advs) {
          carga.push({
            nome: a.name,
            ativo: a.active,
            casosAtribuidos: (await work.myMissions(a.id).catch(() => [])).length,
          });
        }
        d['advogados'] = carga;
      } catch {
        /* idem */
      }
      try {
        d['periciasEmAndamento10Dias'] = (await periciaFluxo.emAndamento()).length;
        d['periciasConcluidasProntasAdvogado'] = (await periciaFluxo.concluidas()).length;
      } catch {
        /* idem */
      }
      // POTENCIAL: só o total + TOP 10 (a lista inteira, com todos os
      // clientes, estourava o prompt do narrador — caso real 2026-07-29: a
      // resposta caía no despejo de JSON cru). Nomes limpos de quebras.
      try {
        const p = (await pericia.potencialDeTodos()) as {
          total?: number;
          porCliente?: readonly {
            chatId: string;
            nomeCliente: string | null;
            valor: number;
            contratos: number;
          }[];
        };
        d['potencialFinanceiro'] = {
          totalReais: Math.round(p.total ?? 0),
          top10Clientes: (p.porCliente ?? []).slice(0, 10).map((c) => ({
            nome: (c.nomeCliente ?? c.chatId.split('@')[0] ?? '').replace(/\s+/g, ' ').trim(),
            valorReais: Math.round(c.valor),
            contratos: c.contratos,
          })),
        };
      } catch {
        /* idem */
      }
      // Recorte GEOGRÁFICO (pergunta real do dono: "quantos clientes e
      // contratos só em São Paulo?"): estado pelo DDD do WhatsApp (sinal
      // universal) e fase 1 completa POR ESTADO — com a soma de contratos E a
      // soma COM O TETO de 10 por cliente (a régua real da distribuição).
      try {
        d['clientesPorEstado'] = (await mapaClientes.gerar()).porEstado;
      } catch {
        /* idem */
      }
      try {
        // Decreto 2026-07-30 (2ª emenda): o teto de 10 por cliente FOI REMOVIDO
        // — a contagem oficial é por LOTES de 3 por banco, calculada com
        // exatidão pelo comando de distribuição ("mova N contratos..."). Aqui
        // ficam os agregados baratos por estado (clientes e contratos reais).
        const fase1 = (await perito.todosComHiscon()).filter((c) => c.temCpf);
        const porUf = new Map<string, { clientes: number; contratos: number }>();
        for (const c of fase1) {
          const uf = ufDoTelefone(c.chatId) ?? 'SEM-DDD';
          const atual = porUf.get(uf) ?? { clientes: 0, contratos: 0 };
          porUf.set(uf, {
            clientes: atual.clientes + 1,
            contratos: atual.contratos + c.totalContratos,
          });
        }
        d['fase1PorEstado'] = Object.fromEntries(porUf);
      } catch {
        /* idem */
      }
      return d;
    },
    fichaPorTermo: async (pergunta) => {
      const semAcento = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const p = semAcento(pergunta);
      const lista = await clientes.list().catch(() => []);
      const cliente =
        lista.find((c) => {
          const n = semAcento(c.quem);
          return n.length >= 5 && p.includes(n);
        }) ?? lista.find((c) => p.includes(c.chatId.split('@')[0] ?? '§§§'));
      if (cliente === undefined) return null;
      const fatos = await jornadaComercial.fatos(cliente.chatId).catch(() => null);
      const mensagens = await conversationStore.recent(cliente.chatId, 15).catch(() => []);
      return {
        chatId: cliente.chatId,
        nome: cliente.quem,
        resumo: {
          status: cliente.status,
          faltando: cliente.faltando,
          cidade: fatos?.registro.cidade ?? null,
          estado: fatos?.registro.estado ?? null,
          cpfRegistrado: (fatos?.registro.cpf ?? null) !== null,
          docsRecebidos: fatos?.docsRecebidos ?? 0,
          ultimoContato: cliente.ultimoContatoAt,
        },
        ultimasMensagens: mensagens
          .filter((m) => m.kind === 'inbound' || m.kind === 'outbound')
          .map(
            (m) => `${m.kind === 'inbound' ? 'CLIENTE' : 'AHRI'}: ${(m.text ?? '').slice(0, 200)}`,
          ),
      };
    },
    // COBRANÇA DE CPF pelo Jarvis (decreto 2026-07-29): os alvos são os mesmos
    // da aba Clientes — HISCON legível e CPF ausente — e o disparo usa a MESMA
    // rotina cobrarCpf (trava de 24h + claim-then-send). Nada duplica.
    pendentesCpf: async () => {
      const comHiscon = await perito.todosComHiscon();
      return comHiscon
        .filter((c) => !c.temCpf)
        .map((c) => ({
          chatId: c.chatId,
          nome: c.quem.replace(/\s+/g, ' ').trim(),
          telefone: c.chatId.split('@')[0] ?? c.chatId,
        }));
    },
    cobrarCpf: async (chatId) => {
      const r = await reaquecimento.cobrarCpf(chatId);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    },
    // MENSAGEM DITADA (decreto 2026-07-30, fim dos automáticos): o destinatário
    // sai do cadastro (nome ou número com DDD) e o envio usa o MESMO trilho
    // manual do admin — gateway + memória da conversa (a AHRI fica ciente).
    resolverDestinatario: async (termo) => {
      const semAcento = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const lista = await clientes.list().catch(() => []);
      const digitos = termo.replace(/\D/g, '');
      if (digitos.length >= 10) {
        const alvo = digitos.startsWith('55') ? digitos : `55${digitos}`;
        const porFone = lista.find((c) => (c.chatId.split('@')[0] ?? '') === alvo);
        if (porFone) return { chatId: porFone.chatId, nome: porFone.quem };
      }
      const t = semAcento(termo);
      const porNome =
        lista.find((c) => semAcento(c.quem) === t) ??
        lista.find((c) => t.length >= 4 && semAcento(c.quem).includes(t));
      return porNome ? { chatId: porNome.chatId, nome: porNome.quem } : null;
    },
    enviarAoCliente: async (chatId, texto) => {
      const receipt = await gateway.sendText(chatId, texto);
      await convMemory.recordOutbound(chatId, texto, receipt.providerMessageId);
    },
    // Decreto 2026-07-31 (Jarvis no cadastro): reprocessa a última mensagem de
    // TEXTO do cliente pela MESMA entrada única — messageId NOVO (a idempotência
    // não engole o resgate); a resposta sai pelo canal do próprio chat.
    retomarAtendimento: async (chatId) => {
      const entradas = await conversationStore.recent(chatId, 80);
      const ultima = [...entradas]
        .reverse()
        .find((e) => e.kind === 'inbound' && e.text !== null && e.text.trim() !== '');
      if (ultima === undefined) {
        return { ok: false, motivo: 'não encontrei mensagem de texto do cliente nesta conversa' };
      }
      const agora = clock.now();
      const envelope: InboundEnvelope = {
        messageId: `retomada-${String(agora.getTime())}-${Math.random().toString(36).slice(2, 8)}`,
        chatId,
        from: chatId,
        kind: 'text',
        text: ultima.text,
        mediaUrl: null,
        mediaMimeType: null,
        fileName: null,
        location: null,
        contact: null,
        reactionEmoji: null,
        reactionToMessageId: null,
        editedText: null,
        deletedMessageId: null,
        silenceMs: null,
        timestamp: agora,
      };
      await (shadowMode ? shadow : plainIngress).receive(envelope);
      return { ok: true, texto: ultima.text ?? '' };
    },
    // RELATÓRIO NOMINAL (decreto 2026-07-30): linhas exatas dos Read Models —
    // nome, telefone (do chatId), UF (jornada, senão DDD) e contratos lidos.
    relatorioClientes: async (recorte, uf) => {
      const comHiscon = await perito.todosComHiscon();
      const linhas: { nome: string; telefone: string; uf: string | null; contratos: number }[] = [];
      for (const c of comHiscon) {
        if (recorte === 'fase1' && !c.temCpf) continue;
        if (recorte === 'sem-cpf' && c.temCpf) continue;
        const fatos = await jornadaComercial.fatos(c.chatId).catch(() => null);
        const ufCliente = fatos?.registro.estado ?? ufDoTelefone(c.chatId);
        if (uf !== null && ufCliente !== uf) continue;
        linhas.push({
          nome: c.quem.replace(/\s+/g, ' ').trim(),
          telefone: c.chatId.split('@')[0] ?? c.chatId,
          uf: ufCliente,
          contratos: c.totalContratos,
        });
      }
      linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return linhas;
    },
    // A MESMA atribuição do painel (work.assign + aviso ao advogado pela AHRI).
    atribuir: async (missionId, advogadoId, assignedBy) => {
      try {
        await projector.refresh().catch(() => undefined);
        const chatId = projector.missions().find((m) => m.missionId === missionId)?.chatId ?? null;
        await work.assign(missionId, advogadoId, assignedBy, chatId);
        try {
          const canais = await notificationChannels.canaisDe(advogadoId);
          const canal =
            canais.find((c) => c.tipo === 'whatsapp' && c.preferido) ??
            canais.find((c) => c.tipo === 'whatsapp');
          if (canal) {
            await gateway.sendText(
              canal.endereco,
              'A AHRIOS encaminhou um novo cliente para você representar. Ele já aparece no seu painel — o primeiro passo costuma ser enviar a procuração para assinatura.',
            );
          }
        } catch {
          /* o aviso é cortesia; a atribuição nunca é desfeita por falha dele */
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'falha na atribuição' };
      }
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
  const component = (
    name: string,
    dependsOn: readonly string[],
    probe: () => Promise<void>,
  ): BootableComponent => ({
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
      registry.all().length >= 2
        ? Promise.resolve()
        : Promise.reject(new Error('subscribers ausentes')),
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
      // 15ª rodada: documento novo supera a progressão pendente do anterior.
      aoReceberDocumento: (chatId) => jornadaComercial.aoReceberDocumento(chatId),
      varredura: async (now) => {
        await documentRequestAutonomia.varredura(now);
        // Decreto 2026-07-22: conversas CAÍDAS (cliente sem resposta) são
        // retomadas automaticamente no MESMO motor temporal — best-effort.
        await reaquecimento.varreduraRetomada(now).catch(() => undefined);
        // Decreto 2026-07-26: às 09:00 (BRT), pede o CPF a quem já entregou o
        // HISCON e ainda não informou — uma vez por pessoa, autorizado pelo dono.
        await reaquecimento.varreduraCpf(now).catch(() => undefined);
      },
    },
    // Medidor de Custo: o turno inteiro roda com o chatId em contexto.
    custos,
    // DECRETO 2026-07-30: follow-ups automáticos DESLIGADOS por padrão.
    wiring.followUpsAutomaticos ?? false,
  );
  const shadow = new ShadowRecorder(
    plainIngress,
    shadowStore,
    {
      missionsOf: (chatId) => projector.missionsOf(chatId),
      timelineCounts: (missionId) => {
        const t = projector.missionTimeline(missionId);
        const count = (type: string): number => t.filter((e) => e.streamType === type).length;
        return {
          truth: count('operational-truth'),
          state: count('operational-state'),
          stage: count('operational-stage'),
        };
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

  // ── WEBCHAT DA AHRI (decreto 2026-07-30): o canal próprio — mesmo fluxo,
  //    mesma jornada, mesmo armazenamento; só o transporte muda ──────────────
  const webchat = new WebchatRuntime({
    json,
    clock,
    ingress: () => (shadowMode ? shadow : plainIngress),
    conversas: conversationStore,
    media: mediaStore,
    references: mediaReferences,
    aoFalhar: (mensagem) => {
      observability.error('webchat', 'turno', clock.now(), mensagem);
    },
  });

  // ── CANAL OFICIAL META (decreto 2026-07-31): o webhook da Cloud API entra
  //    pela MESMA entrada única; mídia baixada pelo Graph vai ao MESMO media
  //    store. Montado só quando META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID. ──
  const metaCanal =
    metaGateway === null
      ? null
      : new MetaCanalRuntime({
          gateway: metaGateway,
          canais,
          ingress: () => (shadowMode ? shadow : plainIngress),
          media: mediaStore,
          references: mediaReferences,
          aoFalhar: (mensagem) => {
            observability.error('meta', 'webhook', clock.now(), mensagem);
          },
        });

  // Decreto 2026-07-31: o canal do ÚLTIMO contato do chat, para a aba Conversa
  // do Painel Admin. Sem registro ⇒ Evolution (o canal historicamente padrão).
  const canalDoChat = async (chatId: string): Promise<'meta' | 'evolution' | 'webchat'> => {
    if (ehChatWeb(chatId)) return 'webchat';
    return (await canais.canalDe(chatId)) ?? 'evolution';
  };

  // ── DOCS DA EQUIPE (decreto 2026-07-30): fase 2 humana — procuração/RG/
  //    comprovante anexados pelo time ao cliente concluso da fase 1 ─────────
  const docsEquipe = new DocsEquipeService({ json, media: mediaStore, clock });

  // ── ATENDIMENTO HUMANIZADO (Onda 2, decreto 2026-07-31): a mesa da
  //    secretária — SÓ os clientes que CONFIRMARAM o parecer (cadastro gerado),
  //    com o status dos 3 documentos da fase 2. Derivado em leitura. ─────────
  const humanizado = {
    clientes: async (): Promise<
      readonly {
        clienteId: string;
        chatId: string;
        nome: string;
        telefone: string;
        uf: string;
        confirmadoEm: string;
        docs: { procuracao: boolean; rg: boolean; comprovante: boolean };
        completo: boolean;
        aguardandoAssinatura: boolean;
      }[]
    > => {
      const lista = await clientes.list();
      const out = [];
      for (const c of lista) {
        if (c.clienteId === c.chatId) continue;
        // Onda 3 (adendo do dono): a mesa exige o INTERESSE CONFIRMADO após o
        // dossiê — cadastro do fluxo antigo (sem parecer/sem SIM) fica FORA.
        const fato = await parecerStore.load(c.clienteId);
        if (fato === null || fato.confirmadoEm == null) continue;
        const anexos = await docsEquipe.listar(c.chatId).catch(() => []);
        const tem = (tipo: string): boolean => anexos.some((d) => d.tipo === tipo);
        const docs = {
          procuracao: tem('procuracao'),
          rg: tem('rg'),
          comprovante: tem('comprovante'),
        };
        // UF (organização da mesa): o estado coletado na jornada; sem ele, o DDD.
        const uf =
          (await jornadaComercial.fatos(c.chatId).catch(() => null))?.registro.estado ??
          ufDoTelefone(c.chatId) ??
          'SEM UF';
        // Marcação da secretária (ns 'humanizado-status'): "enviei a
        // documentação — aguardando o cliente devolver assinada".
        const status = (await json.get('humanizado-status', c.chatId).catch(() => null)) as {
          aguardando?: boolean;
        } | null;
        out.push({
          clienteId: c.clienteId,
          chatId: c.chatId,
          nome: c.quem,
          telefone: c.chatId.split('@')[0]?.replace(/\D/g, '') ?? '',
          uf,
          confirmadoEm: new Date(fato.confirmadoEm).toISOString(),
          docs,
          completo: docs.procuracao && docs.rg && docs.comprovante,
          aguardandoAssinatura: status?.aguardando === true,
        });
      }
      return out.sort((a, b) => b.confirmadoEm.localeCompare(a.confirmadoEm));
    },
    // A secretária marca/desmarca o status "aguardando devolução assinada" —
    // fato simples de organização da mesa; nada automático deriva dele.
    marcarAguardando: async (chatId: string, valor: boolean): Promise<void> => {
      await json.put('humanizado-status', chatId, {
        chatId,
        aguardando: valor,
        em: clock.now().toISOString(),
      });
    },
  };

  // Onda 3 (adendo do dono): o PARECER EM LOTE — a base LEGADA (cadastro do
  // fluxo antigo) nunca viu o dossiê; o disparo é ATO do Admin (um clique, um
  // lote — decreto anti-spam: nada sai sozinho). O fato do parecer é o claim.
  const parecerLote = {
    pendentes: async (): Promise<
      readonly { clienteId: string; chatId: string; nome: string; contratos: number }[]
    > => {
      const comHiscon = await perito.todosComHiscon();
      const out = [];
      for (const c of comHiscon) {
        if (!c.temCpf) continue; // fase 1 completa: CPF + HISCON
        if ((await parecerStore.load(c.clienteId)) !== null) continue;
        out.push({
          clienteId: c.clienteId,
          chatId: c.chatId,
          nome: c.quem,
          contratos: c.totalContratos,
        });
      }
      return out;
    },
    enviar: (clienteId: string): Promise<{ ok: boolean; motivo?: string }> =>
      nascimento.enviarParecer(clienteId, clock.now()),
  };

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
    webchat,
    metaCanal,
    canalDoChat,
    drenarTurnos: (timeoutMs) => plainIngress.aguardarTurnosEmVoo(timeoutMs),
    docsEquipe,
    humanizadoAuth,
    humanizado,
    parecerLote,
    pericia,
    releitura,
    revinculo,
    jarvis,
    periciaFluxo,
    periciaDigital,
    periciaDigitalHabilitado,
    mapaClientes,
    peritoAuth,
    socios,
    socioAuth,
    documentReader,
    custos,
    reaquecimento,
    // Decreto 2026-07-26: o CPF coletado no funil, para o cadastro do cliente.
    jornadaComercial,
    alir,
    acompanhamento,
    nascimento,
    despedida,
    traducao,
  };
}

export const PRODUCTION_DEFAULTS = DEFAULT_PRODUCTION_CONFIG;
