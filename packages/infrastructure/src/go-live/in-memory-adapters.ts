// ─────────────────────────────────────────────────────────────────────────────
// Adapters in-memory dos ports do GO LIVE: scheduler durável, tarefas de handoff,
// progresso de workflow e canal de notificação. Adapters Postgres entram pelos
// mesmos ports, sem tocar os runtimes.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  DeliveredNotification,
  HandoffStore,
  HandoffTask,
  HumanRole,
  MissionProgress,
  NotificationChannelPort,
  ScheduledTask,
  SchedulerStore,
  WorkflowProgressStore,
} from '@reconstrua/application';

export class InMemorySchedulerStore implements SchedulerStore {
  private readonly tasks = new Map<string, ScheduledTask>();
  save(task: ScheduledTask): Promise<void> {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }
  byId(id: string): Promise<ScheduledTask | null> {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }
  due(now: Date): Promise<readonly ScheduledTask[]> {
    const due = [...this.tasks.values()]
      .filter((t) => t.status === 'pending' && t.dueAt.getTime() <= now.getTime())
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    return Promise.resolve(due);
  }
  pendingCount(): Promise<number> {
    return Promise.resolve([...this.tasks.values()].filter((t) => t.status === 'pending').length);
  }
  all(): Promise<readonly ScheduledTask[]> {
    return Promise.resolve([...this.tasks.values()]);
  }
}

export class InMemoryHandoffStore implements HandoffStore {
  private readonly tasks = new Map<string, HandoffTask>();
  save(task: HandoffTask): Promise<void> {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }
  byId(id: string): Promise<HandoffTask | null> {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }
  openByRole(role: HumanRole): Promise<readonly HandoffTask[]> {
    return Promise.resolve(
      [...this.tasks.values()].filter((t) => t.role === role && t.status === 'open'),
    );
  }
}

export class InMemoryWorkflowProgressStore implements WorkflowProgressStore {
  private readonly byMission = new Map<string, MissionProgress>();
  load(missionId: string): Promise<MissionProgress | null> {
    return Promise.resolve(this.byMission.get(missionId) ?? null);
  }
  save(progress: MissionProgress): Promise<void> {
    this.byMission.set(progress.missionId, progress);
    return Promise.resolve();
  }
  all(): Promise<readonly MissionProgress[]> {
    return Promise.resolve([...this.byMission.values()]);
  }
}

export class RecordingNotificationChannel implements NotificationChannelPort {
  private readonly log: DeliveredNotification[] = [];
  deliver(notification: DeliveredNotification): Promise<void> {
    this.log.push(notification);
    return Promise.resolve();
  }
  delivered(): readonly DeliveredNotification[] {
    return [...this.log];
  }
}
