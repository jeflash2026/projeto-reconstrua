// ─────────────────────────────────────────────────────────────────────────────
// assembleAdminOperation — a composição da operação COM o Portal Administrativo.
//
// `assembleGoLive` (2F, CONGELADO) não expõe conversationStore/registry/progresso —
// e não pode ser alterado. Esta composição fia OS MESMOS blocos públicos congelados
// (a mesma operação real) e ADICIONA os read models do portal (TimelineProjector),
// o diretório da equipe e as exposições de leitura que o portal exige. Aditivo puro.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type {
  AdminMetricsStore,
  AdministrationIntelligenceRuntime,
  ConversationGateway,
  ConversationRuntime,
  ConversationStore,
  FounderConsoleRuntime,
  MemoryStore,
  MissionRuntime,
  RelationshipRuntime,
  Sleeper,
  WorkflowProgressStore,
} from '@reconstrua/application';
import {
  BootRuntime,
  DEFAULT_NOTIFICATION_POLICY,
  EventStoreIntegrityAuditor,
  ExponentialBackoffRetryPolicy,
  GoLiveChecklist,
  HealthRuntime,
  HumanHandoffRuntime,
  NotificationRuntime,
  ObservabilityRuntime,
  OutboxRuntime,
  PortalIntegrationRuntime,
  SchedulerRuntime,
  StaffDirectoryRuntime,
  SubscriberRegistry,
  TemporalSignalDispatcher,
  TimelineProjector,
  WorkflowRuntime,
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
  assembleConversationRuntime,
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
import { InMemoryStaffStore } from './in-memory-staff-store.js';

export interface AdminOperationWiring {
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly gateway?: ConversationGateway;
  readonly sleeper?: Sleeper;
  readonly founderName?: string;
}

export interface AssembledAdminOperation {
  readonly conversation: ConversationRuntime;
  readonly mission: MissionRuntime;
  readonly outbox: OutboxRuntime;
  readonly workflow: WorkflowRuntime;
  readonly scheduler: SchedulerRuntime;
  readonly temporal: TemporalSignalDispatcher;
  readonly notification: NotificationRuntime;
  readonly handoff: HumanHandoffRuntime;
  readonly portals: PortalIntegrationRuntime;
  readonly health: HealthRuntime;
  readonly observability: ObservabilityRuntime;
  readonly boot: BootRuntime;
  readonly checklist: GoLiveChecklist;
  readonly gateway: ConversationGateway;
  readonly eventStore: InMemoryEventStore;
  // ── Exposições do PORTAL (read models e configuração) ──
  readonly conversationStore: ConversationStore;
  readonly memoryStore: MemoryStore;
  readonly relationship: RelationshipRuntime;
  readonly metricsStore: AdminMetricsStore;
  readonly admin: AdministrationIntelligenceRuntime;
  readonly founderConsole: FounderConsoleRuntime;
  readonly progressStore: WorkflowProgressStore;
  readonly projector: TimelineProjector;
  readonly staff: StaffDirectoryRuntime;
  readonly auditor: EventStoreIntegrityAuditor;
}

export function assembleAdminOperation(wiring: AdminOperationWiring): AssembledAdminOperation {
  const { clock, uuid } = wiring;
  const hasher = new CryptoHasher();
  const health = new HealthRuntime();
  const observability = new ObservabilityRuntime();

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

  const conversationStore = new InMemoryConversationStore();
  const living = assembleLivingMemory({ clock, uuid, conversationStore });
  const administration = assembleAdministration({
    memoryStore: living.memoryStore,
    founder: { founderName: wiring.founderName ?? 'Jessé' },
  });

  const scheduler = new SchedulerRuntime(new InMemorySchedulerStore());
  const progressStore = new InMemoryWorkflowProgressStore();
  const workflow = new WorkflowRuntime(progressStore, scheduler, undefined, observability);
  const notification = new NotificationRuntime(new RecordingNotificationChannel(), DEFAULT_NOTIFICATION_POLICY);
  const handoff = new HumanHandoffRuntime(new InMemoryHandoffStore());

  registry.register(new SerializedSubscriber(new AdminProjectionSubscriber(administration.metricsStore)), 1, clock.now());
  registry.register(new SerializedSubscriber(workflow), 1, clock.now());

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

  const gateway = wiring.gateway ?? new InMemoryConversationGateway(clock);
  const conversation = assembleConversationRuntime({
    gateway,
    perception: new FakeLlmPerception(),
    expression: new VaryingLlmExpression(),
    brain: fullLoop,
    conversationStore,
    sessionStore: new InMemorySessionStore(),
    queueStore: new InMemoryMessageQueueStore(),
    sleeper: wiring.sleeper ?? new FakeSleeper(),
    clock,
    uuid,
  });

  const projector = new TimelineProjector(eventStore);
  const staff = new StaffDirectoryRuntime(new InMemoryStaffStore(), handoff, clock, uuid);

  return {
    conversation,
    mission: missionAssembly.runtime,
    outbox,
    workflow,
    scheduler,
    temporal: new TemporalSignalDispatcher(scheduler, conversation),
    notification,
    handoff,
    portals: new PortalIntegrationRuntime(administration.metricsStore, handoff, progressStore, health),
    health,
    observability,
    boot: new BootRuntime(health, observability, clock),
    checklist: new GoLiveChecklist(clock),
    gateway,
    eventStore,
    conversationStore,
    memoryStore: living.memoryStore,
    relationship: living.relationship,
    metricsStore: administration.metricsStore,
    admin: administration.admin,
    founderConsole: administration.founderConsole,
    progressStore,
    projector,
    staff,
    auditor: new EventStoreIntegrityAuditor(eventStore, hasher),
  };
}
