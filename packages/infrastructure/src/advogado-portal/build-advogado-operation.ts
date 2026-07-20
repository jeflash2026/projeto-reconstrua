// ─────────────────────────────────────────────────────────────────────────────
// assembleAdvogadoOperation — composição da operação COM o Portal do Advogado.
// Fia os MESMOS blocos públicos congelados (2A–2F) construindo a Conversa a partir
// das peças públicas de 2B (para reter os handles de fila/entrega que o mensageiro
// da ponte usa) e ADICIONA: atribuições, trabalho jurídico, catálogo RO-3B e a
// ponte automática Advogado→AHRI. Aditivo puro; nenhum congelado alterado.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, DocumentRequestState, UuidGenerator } from '@reconstrua/domain';
import type { AnexoStore, ClientesList, ConversationGateway, ConversationRuntime, Sleeper, MemoryStore, AdminMetricsStore, TraducaoClienteRuntime, DocumentRequestRuntime, DocumentRequestStore } from '@reconstrua/application';
import {
  AdvogadoAhriBridge,
  AdvogadoAuthRuntime,
  AdvogadoWorkRuntime,
  ConversationContextRuntime,
  ConversationMemoryRuntime,
  ConversationRuntime as ConversationRuntimeClass,
  DEFAULT_HUMANIZATION_POLICY,
  DelayRuntime,
  DeliveryRuntime,
  ExponentialBackoffRetryPolicy,
  HumanHandoffRuntime,
  HumanLikeTimingRuntime,
  MessageQueueRuntime,
  NotificationRuntime,
  ObservabilityRuntime,
  OutboxRuntime,
  PresenceRuntime,
  PromptBuilderRuntime,
  SchedulerRuntime,
  SessionRuntime,
  SilenceDetectionRuntime,
  StaffDirectoryRuntime,
  SubscriberRegistry,
  TimelineProjector,
  TypingRuntime,
  WorkflowRuntime,
  DEFAULT_NOTIFICATION_POLICY,
} from '@reconstrua/application';
import { InMemoryEventStore } from '../event-store/in-memory-event-store.js';
import { CryptoHasher } from '../event-store/crypto-hasher.js';
import { InMemoryDeliveryStore } from '../event-dispatcher/in-memory-delivery-store.js';
import { InMemoryIdempotencyStore } from '../event-dispatcher/in-memory-idempotency-store.js';
import {
  InMemoryConversationStore,
  InMemoryConversationGateway,
  InMemoryMessageQueueStore,
  InMemorySessionStore,
  FakeLlmPerception,
  VaryingLlmExpression,
  FakeSleeper,
} from '../conversation/index.js';
import { assembleExecutiveBrain } from '../executive-brain/build-executive-brain.js';
import { InMemoryRuleCatalog } from '../executive-brain/in-memory-adapters.js';
import { assembleMissionRuntime } from '../mission-runtime/build-mission-runtime.js';
import { MISSION_RULE_CATALOG } from '../mission-runtime/mission-rule-catalog.js';
import { assembleLivingMemory } from '../living-memory/build-living-memory.js';
import { assembleAdministration } from '../administration/build-administration.js';
import { AdminProjectionSubscriber } from '../administration/admin-projection-subscriber.js';
import {
  InMemoryHandoffStore,
  InMemorySchedulerStore,
  InMemoryWorkflowProgressStore,
  RecordingNotificationChannel,
} from '../go-live/in-memory-adapters.js';
import { FullLoopBrainAdapter } from '../go-live/full-loop-brain-adapter.js';
import { SerializedSubscriber } from '../go-live/serialized-subscriber.js';
import { InMemoryStaffStore } from '../admin-portal/in-memory-staff-store.js';
import { InMemoryAssignmentStore, InMemoryCredenciaisStore, InMemoryJuridicalWorkStore } from './in-memory-adapters.js';
import { ADVOGADO_RULE_CATALOG } from './advogado-rule-catalog.js';
import { ConversationClientMessenger } from './client-messenger.js';
import type { DocumentContentService } from '../media/document-content-service.js';

export interface AdvogadoOperationWiring {
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly gateway?: ConversationGateway;
  readonly sleeper?: Sleeper;
  /** GO-LIVE-04: segredo que assina convites do advogado (testes/dev). */
  readonly authSecret?: string;
}

export interface AssembledAdvogadoOperation {
  readonly conversation: ConversationRuntime;
  readonly gateway: ConversationGateway;
  readonly eventStore: InMemoryEventStore;
  readonly projector: TimelineProjector;
  readonly work: AdvogadoWorkRuntime;
  readonly bridge: AdvogadoAhriBridge;
  readonly staff: StaffDirectoryRuntime;
  readonly handoff: HumanHandoffRuntime;
  readonly observability: ObservabilityRuntime;
  readonly memoryStore: MemoryStore;
  readonly metricsStore: AdminMetricsStore;
  readonly workflow: WorkflowRuntime;
  // BL-3.3: conteúdo real de documento (CAT-02C) — MESMA instância do adminView (opcional).
  readonly documentContent?: DocumentContentService;
  // GO-LIVE-02: tradução humanizada na escrita (só na composição de produção).
  readonly traducao?: TraducaoClienteRuntime;
  // GO-LIVE-04: Auth Runtime compartilhado — provider do advogado (convite→senha→login).
  readonly auth?: AdvogadoAuthRuntime;
  // GO-LIVE 15C (Workflow 2): solicitações complementares — o advogado administra
  // pela API/painel; a AHRI apenas executa. Opcional (composição de produção).
  readonly documentRequests?: DocumentRequestRuntime;
  readonly documentRequestStore?: DocumentRequestStore;
  // 15C-3: disparo proativo (created → messaged → WhatsApp) — só na produção.
  readonly documentRequestComunicador?: { anunciar(state: DocumentRequestState): Promise<{ ok: boolean; erro: string | null }> };
  // Decreto Tráfego Pago · B1: anexo do advogado p/ ASSINATURA (procuração/
  // contrato de honorários) — a AHRI envia o arquivo ao cliente. Só produção.
  readonly documentRequestAnexos?: AnexoStore;
  // Decreto Tráfego Pago · B2: canal de notificação do advogado (número de
  // WhatsApp cadastrado por ele no painel). Só produção.
  readonly notificationChannels?: {
    canaisDe(lawyerId: string): Promise<readonly { tipo: string; endereco: string; preferido: boolean; verificadoEm: string | null }[]>;
    definir(lawyerId: string, canais: readonly { tipo: 'whatsapp' | 'email'; endereco: string; preferido: boolean; verificadoEm: string | null }[]): Promise<void>;
  };
  // Decreto Tráfego Pago: a lista única de clientes (status derivado) — usada
  // pelo painel admin "Clientes prontos p/ Advogado". Só produção.
  readonly clientes?: ClientesList;
}

export function assembleAdvogadoOperation(wiring: AdvogadoOperationWiring): AssembledAdvogadoOperation {
  const { clock, uuid } = wiring;
  const hasher = new CryptoHasher();
  const observability = new ObservabilityRuntime();
  const policy = DEFAULT_HUMANIZATION_POLICY;

  // ── Núcleo 2A + Dispatcher ───────────────────────────────────────────────────
  const eventStore = new InMemoryEventStore(hasher, uuid, clock);
  const registry = new SubscriberRegistry();
  const outbox = new OutboxRuntime({
    outbox: eventStore,
    deliveries: new InMemoryDeliveryStore(),
    idempotency: new InMemoryIdempotencyStore(),
    registry,
    retryPolicy: new ExponentialBackoffRetryPolicy({ baseMs: 1000, factor: 2, maxMs: 60_000, maxAttempts: 5, jitter: 0 }),
    clock,
  });

  // ── 2E ───────────────────────────────────────────────────────────────────────
  const conversationStore = new InMemoryConversationStore();
  const living = assembleLivingMemory({ clock, uuid, conversationStore });
  const administration = assembleAdministration({ memoryStore: living.memoryStore, founder: { founderName: 'Jessé' } });

  // ── 2F ───────────────────────────────────────────────────────────────────────
  const scheduler = new SchedulerRuntime(new InMemorySchedulerStore());
  const progressStore = new InMemoryWorkflowProgressStore();
  const workflow = new WorkflowRuntime(progressStore, scheduler, undefined, observability);
  const notification = new NotificationRuntime(new RecordingNotificationChannel(), DEFAULT_NOTIFICATION_POLICY);
  const handoff = new HumanHandoffRuntime(new InMemoryHandoffStore());
  registry.register(new SerializedSubscriber(new AdminProjectionSubscriber(administration.metricsStore)), 1, clock.now());
  registry.register(new SerializedSubscriber(workflow), 1, clock.now());

  // ── 2C + 2D ──────────────────────────────────────────────────────────────────
  const brainAssembly = assembleExecutiveBrain({ clock, uuid, rules: new InMemoryRuleCatalog(MISSION_RULE_CATALOG) });
  const missionAssembly = assembleMissionRuntime({ eventStore, hasher, uuid, clock });

  const fullLoop = new FullLoopBrainAdapter({
    brain: brainAssembly.brain,
    rules: brainAssembly.rules,
    snapshots: brainAssembly.snapshots,
    mission: missionAssembly.runtime,
    outbox,
    notification,
    handoff,
    memoryIngestor: living.ingestor,
    noteWriter: living.noteWriter,
    observability,
    clock,
  });

  // ── 2B construída das peças públicas (handles retidos para o mensageiro) ─────
  const gateway = wiring.gateway ?? new InMemoryConversationGateway(clock);
  const sleeper = wiring.sleeper ?? new FakeSleeper();
  const expression = new VaryingLlmExpression();
  const sessions = new SessionRuntime(new InMemorySessionStore());
  const memory = new ConversationMemoryRuntime(conversationStore, clock, uuid);
  const context = new ConversationContextRuntime(sessions, memory);
  const promptBuilder = new PromptBuilderRuntime(policy.antiRepetitionWindow);
  const timing = new HumanLikeTimingRuntime(policy, Math.random);
  const delay = new DelayRuntime(sleeper);
  const presence = new PresenceRuntime(gateway, sessions);
  const typing = new TypingRuntime(presence, delay);
  const queue = new MessageQueueRuntime(new InMemoryMessageQueueStore(), clock, uuid);
  const delivery = new DeliveryRuntime({ gateway, timing, typing, delay, presence, queue, sessions, memory, clock, policy });
  const conversation = new ConversationRuntimeClass({
    perception: new FakeLlmPerception(),
    expression,
    brain: fullLoop,
    gateway,
    sessions,
    memory,
    context,
    promptBuilder,
    queue,
    delivery,
    silence: new SilenceDetectionRuntime(policy),
    clock,
    uuid,
    policy,
  });

  // ── 3B: projector, trabalho jurídico, ponte AHRI ─────────────────────────────
  const projector = new TimelineProjector(eventStore);
  const work = new AdvogadoWorkRuntime(new InMemoryAssignmentStore(), new InMemoryJuridicalWorkStore(), clock, uuid);
  const messenger = new ConversationClientMessenger({ memory, context, promptBuilder, expression, queue, delivery, policy, clock });
  const bridge = new AdvogadoAhriBridge({
    brain: brainAssembly.brain,
    rules: ADVOGADO_RULE_CATALOG,
    messenger,
    clock,
    chatOf: (missionId) => projector.missions().find((m) => m.missionId === missionId)?.chatId ?? null,
  });
  const staffStore = new InMemoryStaffStore();
  const staff = new StaffDirectoryRuntime(staffStore, handoff, clock, uuid);

  // GO-LIVE-04: provider do advogado sobre o Auth Runtime compartilhado.
  const auth = new AdvogadoAuthRuntime({
    staff: staffStore,
    credenciais: new InMemoryCredenciaisStore(),
    secret: wiring.authSecret ?? 'segredo-advogado-dev',
  });

  return {
    conversation,
    gateway,
    eventStore,
    projector,
    work,
    bridge,
    staff,
    handoff,
    observability,
    memoryStore: living.memoryStore,
    metricsStore: administration.metricsStore,
    workflow,
    auth,
  };
}
