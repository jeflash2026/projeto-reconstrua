// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT STORES — adapters de TODOS os ports de documento da operação sobre o
// JsonStore (Postgres real em produção; in-memory em dev/test). Só adapters;
// nenhum runtime muda. Datas são revividas na leitura.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AdminMetrics,
  AdminMetricsStore,
  AssignmentStore,
  CaseAssignment,
  ClientMemory,
  ConfigStore,
  ConversationStore,
  CursorStore,
  DecisionRequest,
  DecisionStore,
  HandoffStore,
  HandoffTask,
  HumanRole,
  JuridicalEntry,
  JuridicalWorkStore,
  LawyerCursor,
  LawyerDecisionType,
  MemoryEntry,
  MemoryStore,
  MissionIdentity,
  MissionIdentityMap,
  MissionProgress,
  ProductionConfig,
  ProductivityEvent,
  ProductivityStore,
  ScheduledTask,
  SchedulerStore,
  Session,
  SessionStore,
  StaffMember,
  StaffRole,
  StaffStore,
  WorkflowProgressStore,
} from '@reconstrua/application';
import type { JsonStore } from './json-store.js';
import { reviveDates } from './json-store.js';

const DATE_KEYS = [
  'at', 'createdAt', 'updatedAt', 'dueAt', 'openedAt', 'assignedAt', 'recognizedAt', 'observedAt',
  'lastAccessAt', 'lastInboundAt', 'lastOutboundAt', 'lastContactAt', 'firstContactAt', 'lastSilenceNoticeAt',
  'resolvedAt', 'enqueuedAt', 'nextAttemptAt', 'lockedAt', 'occurredAt', 'recordedAt', 'formedAt',
  'reportedAt', 'lastProcessedAt', 'framedAt', 'presentedAt', 'synthesizedAt', 'derivedAt',
] as const;

function revive<T>(value: unknown): T {
  return reviveDates<T>(value, DATE_KEYS);
}

export class JsonConfigStore implements ConfigStore {
  constructor(private readonly store: JsonStore) {}
  async load(): Promise<ProductionConfig | null> {
    const raw = await this.store.get('config', 'production');
    return raw === null ? null : revive<ProductionConfig>(raw);
  }
  save(config: ProductionConfig): Promise<void> {
    return this.store.put('config', 'production', config);
  }
}

export class JsonMemoryStore implements MemoryStore {
  constructor(private readonly store: JsonStore) {}
  async load(chatId: string): Promise<ClientMemory | null> {
    const raw = await this.store.get('client-memory', chatId);
    return raw === null ? null : revive<ClientMemory>(raw);
  }
  save(memory: ClientMemory): Promise<void> {
    return this.store.put('client-memory', memory.chatId, memory);
  }
  async all(): Promise<readonly ClientMemory[]> {
    return (await this.store.list('client-memory')).map((m) => revive<ClientMemory>(m));
  }
}

export class JsonMetricsStore implements AdminMetricsStore {
  constructor(private readonly store: JsonStore) {}
  async load(): Promise<AdminMetrics | null> {
    const raw = await this.store.get('admin-metrics', 'current');
    return raw === null ? null : revive<AdminMetrics>(raw);
  }
  save(metrics: AdminMetrics): Promise<void> {
    return this.store.put('admin-metrics', 'current', metrics);
  }
}

export class JsonSessionStore implements SessionStore {
  constructor(private readonly store: JsonStore) {}
  async getOrOpen(chatId: string, now: Date): Promise<Session> {
    const raw = await this.store.get('sessions', chatId);
    if (raw !== null) return revive<Session>(raw);
    const opened: Session = {
      chatId, openedAt: now, lastInboundAt: null, lastOutboundAt: null, turns: 0,
      presence: 'available', awaitingDocuments: false, status: 'active', lastSilenceNoticeAt: null,
    };
    await this.store.put('sessions', chatId, opened);
    return opened;
  }
  save(session: Session): Promise<void> {
    return this.store.put('sessions', session.chatId, session);
  }
  async all(): Promise<readonly Session[]> {
    return (await this.store.list('sessions')).map((s) => revive<Session>(s));
  }
}

export class JsonConversationStore implements ConversationStore {
  constructor(private readonly store: JsonStore) {}
  private seq = 0;
  async append(entry: MemoryEntry): Promise<void> {
    this.seq += 1;
    const key = `${entry.at.toISOString()}|${String(this.seq).padStart(6, '0')}|${entry.id}`;
    await this.store.put(`conv:${entry.chatId}`, key, entry);
    if (entry.kind === 'inbound') {
      const messageId = entry.meta['messageId'];
      if (messageId !== undefined) await this.store.put(`conv-idx:${entry.chatId}`, messageId, true);
    }
  }
  private async entries(chatId: string): Promise<readonly MemoryEntry[]> {
    return (await this.store.list(`conv:${chatId}`)).map((e) => revive<MemoryEntry>(e));
  }
  async recent(chatId: string, limit: number): Promise<readonly MemoryEntry[]> {
    const all = await this.entries(chatId);
    return all.slice(Math.max(0, all.length - limit));
  }
  async recentOutboundTexts(chatId: string, limit: number): Promise<readonly string[]> {
    const all = await this.entries(chatId);
    const texts: string[] = [];
    for (let i = all.length - 1; i >= 0 && texts.length < limit; i -= 1) {
      const e = all[i];
      if (e && e.kind === 'outbound' && e.text !== null) texts.push(e.text);
    }
    return texts;
  }
  async lastInboundAt(chatId: string): Promise<Date | null> {
    const all = await this.entries(chatId);
    for (let i = all.length - 1; i >= 0; i -= 1) {
      const e = all[i];
      if (e && e.kind === 'inbound') return e.at;
    }
    return null;
  }
  async hasInbound(chatId: string, providerMessageId: string): Promise<boolean> {
    return (await this.store.get(`conv-idx:${chatId}`, providerMessageId)) !== null;
  }
}

export class JsonSchedulerStore implements SchedulerStore {
  constructor(private readonly store: JsonStore) {}
  save(task: ScheduledTask): Promise<void> {
    return this.store.put('scheduler', task.id, task);
  }
  async byId(id: string): Promise<ScheduledTask | null> {
    const raw = await this.store.get('scheduler', id);
    return raw === null ? null : revive<ScheduledTask>(raw);
  }
  async due(now: Date): Promise<readonly ScheduledTask[]> {
    return (await this.store.list('scheduler'))
      .map((t) => revive<ScheduledTask>(t))
      .filter((t) => t.status === 'pending' && t.dueAt.getTime() <= now.getTime())
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }
  async pendingCount(): Promise<number> {
    return (await this.store.list('scheduler')).map((t) => revive<ScheduledTask>(t)).filter((t) => t.status === 'pending').length;
  }
  async all(): Promise<readonly ScheduledTask[]> {
    return (await this.store.list('scheduler')).map((t) => revive<ScheduledTask>(t));
  }
}

export class JsonHandoffStore implements HandoffStore {
  constructor(private readonly store: JsonStore) {}
  save(task: HandoffTask): Promise<void> {
    return this.store.put('handoff', task.id, task);
  }
  async byId(id: string): Promise<HandoffTask | null> {
    const raw = await this.store.get('handoff', id);
    return raw === null ? null : revive<HandoffTask>(raw);
  }
  async openByRole(role: HumanRole): Promise<readonly HandoffTask[]> {
    return (await this.store.list('handoff'))
      .map((t) => revive<HandoffTask>(t))
      .filter((t) => t.role === role && t.status === 'open');
  }
}

export class JsonProgressStore implements WorkflowProgressStore {
  constructor(private readonly store: JsonStore) {}
  async load(missionId: string): Promise<MissionProgress | null> {
    const raw = await this.store.get('workflow', missionId);
    return raw === null ? null : revive<MissionProgress>(raw);
  }
  save(progress: MissionProgress): Promise<void> {
    return this.store.put('workflow', progress.missionId, progress);
  }
  async all(): Promise<readonly MissionProgress[]> {
    return (await this.store.list('workflow')).map((p) => revive<MissionProgress>(p));
  }
}

export class JsonStaffStore implements StaffStore {
  constructor(private readonly store: JsonStore) {}
  save(member: StaffMember): Promise<void> {
    return this.store.put('staff', member.id, member);
  }
  async byId(id: string): Promise<StaffMember | null> {
    const raw = await this.store.get('staff', id);
    return raw === null ? null : revive<StaffMember>(raw);
  }
  async byRole(role: StaffRole): Promise<readonly StaffMember[]> {
    return (await this.store.list('staff')).map((m) => revive<StaffMember>(m)).filter((m) => m.role === role);
  }
  async all(): Promise<readonly StaffMember[]> {
    return (await this.store.list('staff')).map((m) => revive<StaffMember>(m));
  }
}

export class JsonAssignmentStore implements AssignmentStore {
  constructor(private readonly store: JsonStore) {}
  save(assignment: CaseAssignment): Promise<void> {
    return this.store.put('assignments', assignment.missionId, assignment);
  }
  async byMission(missionId: string): Promise<CaseAssignment | null> {
    const raw = await this.store.get('assignments', missionId);
    return raw === null ? null : revive<CaseAssignment>(raw);
  }
  async byAdvogado(advogadoId: string): Promise<readonly CaseAssignment[]> {
    return (await this.store.list('assignments')).map((a) => revive<CaseAssignment>(a)).filter((a) => a.advogadoId === advogadoId);
  }
}

export class JsonJuridicalWorkStore implements JuridicalWorkStore {
  constructor(private readonly store: JsonStore) {}
  save(entry: JuridicalEntry): Promise<void> {
    return this.store.put('juridical', entry.id, entry);
  }
  async byId(id: string): Promise<JuridicalEntry | null> {
    const raw = await this.store.get('juridical', id);
    return raw === null ? null : revive<JuridicalEntry>(raw);
  }
  async byAdvogado(advogadoId: string): Promise<readonly JuridicalEntry[]> {
    return (await this.store.list('juridical')).map((e) => revive<JuridicalEntry>(e)).filter((e) => e.advogadoId === advogadoId);
  }
  async byMission(missionId: string): Promise<readonly JuridicalEntry[]> {
    return (await this.store.list('juridical')).map((e) => revive<JuridicalEntry>(e)).filter((e) => e.missionId === missionId);
  }
}

export class JsonCursorStore implements CursorStore {
  constructor(private readonly store: JsonStore) {}
  async load(advogadoId: string): Promise<LawyerCursor | null> {
    const raw = await this.store.get('cursors', advogadoId);
    return raw === null ? null : revive<LawyerCursor>(raw);
  }
  save(cursor: LawyerCursor): Promise<void> {
    return this.store.put('cursors', cursor.advogadoId, cursor);
  }
}

export class JsonDecisionStore implements DecisionStore {
  constructor(private readonly store: JsonStore) {}
  save(decision: DecisionRequest): Promise<void> {
    return this.store.put('decisions', decision.id, decision);
  }
  async byId(id: string): Promise<DecisionRequest | null> {
    const raw = await this.store.get('decisions', id);
    return raw === null ? null : revive<DecisionRequest>(raw);
  }
  async openFor(advogadoId: string): Promise<readonly DecisionRequest[]> {
    return (await this.store.list('decisions'))
      .map((d) => revive<DecisionRequest>(d))
      .filter((d) => d.advogadoId === advogadoId && d.status === 'open');
  }
  async byMissionAndType(missionId: string, type: LawyerDecisionType): Promise<DecisionRequest | null> {
    return (
      (await this.store.list('decisions'))
        .map((d) => revive<DecisionRequest>(d))
        .find((d) => d.missionId === missionId && d.type === type && d.status === 'open') ?? null
    );
  }
}

export class JsonProductivityStore implements ProductivityStore {
  constructor(private readonly store: JsonStore) {}
  private seq = 0;
  async record(event: ProductivityEvent): Promise<void> {
    this.seq += 1;
    await this.store.put('productivity', `${event.at.toISOString()}|${String(this.seq).padStart(6, '0')}`, event);
  }
  async byAdvogado(advogadoId: string): Promise<readonly ProductivityEvent[]> {
    return (await this.store.list('productivity')).map((e) => revive<ProductivityEvent>(e)).filter((e) => e.advogadoId === advogadoId);
  }
}

export class JsonIdentityMap implements MissionIdentityMap {
  constructor(private readonly store: JsonStore) {}
  async load(chatId: string): Promise<MissionIdentity | null> {
    const raw = await this.store.get('identities', chatId);
    return raw === null ? null : revive<MissionIdentity>(raw);
  }
  save(identity: MissionIdentity): Promise<void> {
    return this.store.put('identities', identity.chatId, identity);
  }
}
