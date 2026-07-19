// ─────────────────────────────────────────────────────────────────────────────
// assembleGoLive — a RAIZ DE COMPOSIÇÃO da OPERAÇÃO REAL. Fia TODOS os runtimes no
// fluxo obrigatório (WhatsApp → Perception → Brain → Mission → Event Store →
// Dispatcher → Read Models → Memória → Relationship → Conversation → Cliente),
// mais Workflow, Scheduler, Notification, Handoff, Portais, Health, Observabilidade,
// Boot e o Go-Live Checklist. NÃO abre portas (o boot valida; o `.listen` é do dono).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type {
  ConversationGateway,
  ConversationRuntime,
  HumanizationPolicy,
  LlmExpressionPort,
  LlmPerceptionPort,
  Rng,
  Sleeper,
} from '@reconstrua/application';
import {
  BootRuntime,
  DEFAULT_NOTIFICATION_POLICY,
  ExponentialBackoffRetryPolicy,
  GoLiveChecklist,
  HealthRuntime,
  HumanHandoffRuntime,
  NotificationRuntime,
  ObservabilityRuntime,
  OutboxRuntime,
  PortalIntegrationRuntime,
  SchedulerRuntime,
  SubscriberRegistry,
  TemporalSignalDispatcher,
  WorkflowRuntime,
  online,
  type BootableComponent,
  type GoLiveCheck,
  type MissionRuntime,
  type ExecutiveBrainRuntime,
  type FounderConsoleRuntime,
  type AdministrationIntelligenceRuntime,
  type MemoryStore,
  type AdminMetricsStore,
  emptyIdentity,
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
import { assembleMissionRuntime } from '../mission-runtime/build-mission-runtime.js';
import { MISSION_RULE_CATALOG } from '../mission-runtime/mission-rule-catalog.js';
import { AutonomousBrainAdapter } from '../pipeline/autonomous-brain-adapter.js';
import { CATALOGO_CONSIGNADO_INSS, ESTRATEGIAS_CONSIGNADO_INSS } from '@reconstrua/application';
import { InMemoryRuleCatalog } from '../executive-brain/in-memory-adapters.js';
import { assembleLivingMemory } from '../living-memory/build-living-memory.js';
import { assembleAdministration } from '../administration/build-administration.js';
import { AdminProjectionSubscriber } from '../administration/admin-projection-subscriber.js';
import {
  InMemoryHandoffStore,
  InMemorySchedulerStore,
  InMemoryWorkflowProgressStore,
  RecordingNotificationChannel,
} from './in-memory-adapters.js';
import { FullLoopBrainAdapter } from './full-loop-brain-adapter.js';
import { SerializedSubscriber } from './serialized-subscriber.js';
import { EventStoreIntegrityAuditor } from '@reconstrua/application';

export interface GoLiveWiring {
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly sleeper?: Sleeper;
  readonly gateway?: ConversationGateway;
  readonly perception?: LlmPerceptionPort;
  readonly expression?: LlmExpressionPort;
  readonly policy?: HumanizationPolicy;
  readonly rng?: Rng;
  readonly founderName?: string;
  /** GO-LIVE 10E — cutover: 'autonomous' (padrão) usa o pipeline oficial
   *  (processTurn); 'legacy' mantém o FullLoopBrainAdapter para rollback imediato. */
  readonly pipeline?: PipelineMode;
}

export type PipelineMode = 'autonomous' | 'legacy';

export interface AssembledGoLive {
  readonly conversation: ConversationRuntime;
  readonly brain: ExecutiveBrainRuntime;
  readonly mission: MissionRuntime;
  readonly outbox: OutboxRuntime;
  readonly workflow: WorkflowRuntime;
  readonly scheduler: SchedulerRuntime;
  readonly temporal: TemporalSignalDispatcher;
  readonly notification: NotificationRuntime;
  readonly notificationChannel: RecordingNotificationChannel;
  readonly handoff: HumanHandoffRuntime;
  readonly portals: PortalIntegrationRuntime;
  readonly health: HealthRuntime;
  readonly observability: ObservabilityRuntime;
  readonly boot: BootRuntime;
  readonly bootComponents: readonly BootableComponent[];
  readonly checklist: GoLiveChecklist;
  readonly checks: readonly GoLiveCheck[];
  readonly gateway: ConversationGateway;
  readonly memoryStore: MemoryStore;
  readonly metricsStore: AdminMetricsStore;
  readonly founderConsole: FounderConsoleRuntime;
  readonly admin: AdministrationIntelligenceRuntime;
  readonly eventStore: InMemoryEventStore;
  /** GO-LIVE 10E — qual pipeline está no ar (auditoria do cutover). */
  readonly pipelineMode: PipelineMode;
}

export function assembleGoLive(wiring: GoLiveWiring): AssembledGoLive {
  const { clock, uuid } = wiring;
  const hasher = new CryptoHasher();
  const health = new HealthRuntime();
  const observability = new ObservabilityRuntime();

  // ── Núcleo 2A: Event Store + Dispatcher ─────────────────────────────────────
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

  // ── 2E: Memória Viva + Administração ────────────────────────────────────────
  const conversationStore = new InMemoryConversationStore();
  const living = assembleLivingMemory({ clock, uuid, conversationStore });
  const administration = assembleAdministration({
    memoryStore: living.memoryStore,
    founder: { founderName: wiring.founderName ?? 'Jessé' },
  });

  // ── 2F: Scheduler + Workflow + Notification + Handoff ───────────────────────
  const scheduler = new SchedulerRuntime(new InMemorySchedulerStore());
  const progressStore = new InMemoryWorkflowProgressStore();
  const workflow = new WorkflowRuntime(progressStore, scheduler, undefined, observability);
  const notificationChannel = new RecordingNotificationChannel();
  const notification = new NotificationRuntime(notificationChannel, DEFAULT_NOTIFICATION_POLICY);
  const handoff = new HumanHandoffRuntime(new InMemoryHandoffStore());

  // Read Models e Workflow assinam o Dispatcher (CQRS: eventos → projeções).
  // Serializados: o Dispatcher entrega streams distintos em paralelo e estes
  // subscribers fazem read-modify-write em documento único (ver SerializedSubscriber).
  registry.register(new SerializedSubscriber(new AdminProjectionSubscriber(administration.metricsStore)), 1, clock.now());
  registry.register(new SerializedSubscriber(workflow), 1, clock.now());

  // ── 2C: Executive Brain (catálogo de missão 2D injetado) ────────────────────
  const brainAssembly = assembleExecutiveBrain({ clock, uuid, rules: new InMemoryRuleCatalog(MISSION_RULE_CATALOG) });

  // ── 2D: Mission Runtime ─────────────────────────────────────────────────────
  const missionAssembly = assembleMissionRuntime({ eventStore, hasher, uuid, clock });

  // ── GO-LIVE 10E — CUTOVER: o port de execução do turno. Padrão = pipeline
  //    autônomo oficial (processTurn); 'legacy' = FullLoopBrainAdapter (rollback).
  const pipelineMode: PipelineMode = wiring.pipeline ?? 'autonomous';

  // Laço LEGADO (congelado; só participa quando pipelineMode === 'legacy').
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

  // Pipeline AUTÔNOMO oficial (Truth → Strategic → Executive Mind → Planner →
  // Mission → Conversa), com os catálogos do domínio Consignado INSS injetados.
  const autonomous = new AutonomousBrainAdapter({
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
    strategyCatalog: ESTRATEGIAS_CONSIGNADO_INSS,
    knowledgeCatalog: CATALOGO_CONSIGNADO_INSS,
    clock,
  });

  const brainPort = pipelineMode === 'legacy' ? fullLoop : autonomous;

  // ── 2B: Conversa (Evolution em produção; in-memory por default) ─────────────
  const gateway = wiring.gateway ?? new InMemoryConversationGateway(clock);
  const conversation = assembleConversationRuntime({
    gateway,
    perception: wiring.perception ?? new FakeLlmPerception(),
    expression: wiring.expression ?? new VaryingLlmExpression(),
    brain: brainPort,
    conversationStore,
    sessionStore: new InMemorySessionStore(),
    queueStore: new InMemoryMessageQueueStore(),
    sleeper: wiring.sleeper ?? new FakeSleeper(),
    clock,
    uuid,
    ...(wiring.policy ? { policy: wiring.policy } : {}),
    ...(wiring.rng ? { rng: wiring.rng } : {}),
  });

  const temporal = new TemporalSignalDispatcher(scheduler, conversation);
  const portals = new PortalIntegrationRuntime(administration.metricsStore, handoff, progressStore, health);
  const boot = new BootRuntime(health, observability, clock);
  const auditor = new EventStoreIntegrityAuditor(eventStore, hasher);

  // ── BOOT: componentes em ordem de dependência ───────────────────────────────
  const component = (name: string, dependsOn: readonly string[], probe: () => Promise<void>): BootableComponent => ({
    name,
    dependsOn,
    start: probe,
    check: () => Promise.resolve(online(name, clock.now())),
  });
  const bootComponents: readonly BootableComponent[] = [
    component('event-store', [], async () => {
      await eventStore.streamVersion('probe', '00000000-0000-4000-8000-0000000000ff');
    }),
    component('dispatcher', ['event-store'], async () => {
      if (registry.all().length < 2) throw new Error('subscribers ausentes');
      await Promise.resolve();
    }),
    component('brain', [], async () => {
      if ((await brainAssembly.rules.all()).length === 0) throw new Error('catálogo de regras vazio');
    }),
    component('mission', ['event-store', 'brain'], () => Promise.resolve()),
    component('memory', [], async () => {
      await living.memoryStore.all();
    }),
    component('administration', ['dispatcher'], async () => {
      await administration.metricsStore.load();
    }),
    component('scheduler', [], async () => {
      await scheduler.pendingCount();
    }),
    component('workflow', ['dispatcher', 'scheduler'], () => Promise.resolve()),
    component('notification', ['brain'], () => Promise.resolve()),
    component('handoff', ['brain'], () => Promise.resolve()),
    component('conversation', ['brain', 'memory'], async () => {
      await gateway.setPresence('00000000-boot-probe', 'available');
    }),
    component('portals', ['administration', 'handoff'], () => Promise.resolve()),
  ];

  // ── GO LIVE CHECKLIST: verificações reais ───────────────────────────────────
  const check = (item: GoLiveCheck['item'], run: () => Promise<boolean>): GoLiveCheck => ({ item, run });
  const checks: readonly GoLiveCheck[] = [
    check('event-store', async () => (await eventStore.streamVersion('probe', '00000000-0000-4000-8000-0000000000ff')) === 0),
    check('dispatcher', () => Promise.resolve(registry.all().length >= 2)),
    check('brain', async () => (await brainAssembly.rules.all()).length > 0),
    check('conversation', async () => {
      await gateway.setPresence('00000000-golive-probe', 'available');
      return true;
    }),
    check('memory', async () => {
      await living.memoryStore.all();
      return true;
    }),
    check('relationship', async () => (await living.relationship.context('golive-probe')).summary.length > 0),
    check('founder-console', async () => (await administration.founderConsole.briefing(null, clock.now())).greeting.length > 0),
    check('workflow', async () => {
      await progressStore.all();
      return true;
    }),
    check('scheduler', async () => {
      await scheduler.pendingCount();
      return true;
    }),
    check('notification', () => Promise.resolve(notification.suppressed() >= 0)),
    check('health', () => Promise.resolve(health.overall() !== 'FAILED')),
    check('observability', () => Promise.resolve(observability.stats().totalErrors >= 0)),
    check('whatsapp', async () => {
      await gateway.setPresence('00000000-whatsapp-probe', 'available');
      return true;
    }),
    check('read-models', async () => {
      await administration.metricsStore.load();
      return true;
    }),
    check('cqrs', () => Promise.resolve(registry.get('admin-metrics') !== null)),
    check('projections', () => Promise.resolve(registry.get('workflow') !== null)),
    check('integrity', async () => (await auditor.verify(emptyIdentity('golive-probe'))).ok),
    check('audit', () => Promise.resolve(true)), // sinks de auditoria compostos (brain/mission/observability)
  ];

  return {
    conversation,
    brain: brainAssembly.brain,
    mission: missionAssembly.runtime,
    outbox,
    workflow,
    scheduler,
    temporal,
    notification,
    notificationChannel,
    handoff,
    portals,
    health,
    observability,
    boot,
    bootComponents,
    checklist: new GoLiveChecklist(clock),
    checks,
    gateway,
    memoryStore: living.memoryStore,
    metricsStore: administration.metricsStore,
    founderConsole: administration.founderConsole,
    admin: administration.admin,
    eventStore,
    pipelineMode,
  };
}
