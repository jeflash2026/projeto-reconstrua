// ─────────────────────────────────────────────────────────────────────────────
// assembleExecutiveBrain — raiz de composição do Brain: fia o ExecutiveBrainRuntime
// com o catálogo de regras, o snapshot store, o resolvedor e o sink de auditoria, e
// devolve também o ConversationBrainAdapter (o consumidor da Conversa 2B). Um único
// lugar de montagem — usado por testes e pela API.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type {
  BrainAuditSink,
  ExecutiveBrainPort,
  MissionResolverPort,
  MissionSnapshotPort,
  RuleCatalogPort,
} from '@reconstrua/application';
import { ExecutiveBrainRuntime } from '@reconstrua/application';
import {
  ChatIdMissionResolver,
  InMemoryBrainAuditSink,
  InMemoryMissionSnapshotStore,
  InMemoryRuleCatalog,
} from './in-memory-adapters.js';
import { ConversationBrainAdapter } from './conversation-brain-adapter.js';

export interface ExecutiveBrainWiring {
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly rules?: RuleCatalogPort;
  readonly snapshots?: MissionSnapshotPort;
  readonly resolver?: MissionResolverPort;
  readonly auditSink?: BrainAuditSink;
}

export interface AssembledExecutiveBrain {
  readonly brain: ExecutiveBrainRuntime;
  readonly adapter: ExecutiveBrainPort;
  readonly rules: RuleCatalogPort;
  readonly snapshots: MissionSnapshotPort;
  readonly resolver: MissionResolverPort;
  readonly auditSink: BrainAuditSink;
}

export function assembleExecutiveBrain(wiring: ExecutiveBrainWiring): AssembledExecutiveBrain {
  const rules = wiring.rules ?? new InMemoryRuleCatalog();
  const snapshots = wiring.snapshots ?? new InMemoryMissionSnapshotStore();
  const resolver = wiring.resolver ?? new ChatIdMissionResolver();
  const auditSink = wiring.auditSink ?? new InMemoryBrainAuditSink();

  const brain = new ExecutiveBrainRuntime({ clock: wiring.clock, uuid: wiring.uuid, auditSink });
  const adapter = new ConversationBrainAdapter({ brain, snapshots, rules, resolver, clock: wiring.clock });

  return { brain, adapter, rules, snapshots, resolver, auditSink };
}
