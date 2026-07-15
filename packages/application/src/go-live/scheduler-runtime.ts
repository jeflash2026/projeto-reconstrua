// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULER RUNTIME — tarefas FUTURAS duráveis (esperar N dias, lembrar cliente,
// reenviar solicitação, acompanhar prazo/advogado/perito). O scheduler NÃO decide
// O QUE fazer: quando a tarefa vence, ele a entrega como SINAL TEMPORAL — quem
// decide a ação é o Executive Brain (via percepção temporal de 2B). Idempotente
// por id; cancelável; reagendável.
// ─────────────────────────────────────────────────────────────────────────────

export type ScheduledTaskKind =
  | 'remind_client'
  | 'resend_request'
  | 'follow_deadline'
  | 'follow_advogado'
  | 'follow_perito'
  | 'follow_document'
  | 'custom';

export interface ScheduledTask {
  readonly id: string;
  readonly chatId: string;
  readonly missionId: string | null;
  readonly kind: ScheduledTaskKind;
  readonly dueAt: Date;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly status: 'pending' | 'fired' | 'cancelled';
}

export interface SchedulerStore {
  save(task: ScheduledTask): Promise<void>;
  byId(id: string): Promise<ScheduledTask | null>;
  due(now: Date): Promise<readonly ScheduledTask[]>;
  pendingCount(): Promise<number>;
}

export class SchedulerRuntime {
  constructor(private readonly store: SchedulerStore) {}

  async schedule(task: Omit<ScheduledTask, 'status'>): Promise<ScheduledTask> {
    const existing = await this.store.byId(task.id);
    if (existing) return existing; // idempotente por id
    const scheduled: ScheduledTask = { ...task, status: 'pending' };
    await this.store.save(scheduled);
    return scheduled;
  }

  async cancel(id: string): Promise<void> {
    const task = await this.store.byId(id);
    if (task && task.status === 'pending') {
      await this.store.save({ ...task, status: 'cancelled' });
    }
  }

  /** Devolve e marca as tarefas vencidas (cada uma vira um sinal temporal). */
  async fireDue(now: Date): Promise<readonly ScheduledTask[]> {
    const due = await this.store.due(now);
    const fired: ScheduledTask[] = [];
    for (const task of due) {
      await this.store.save({ ...task, status: 'fired' });
      fired.push({ ...task, status: 'fired' });
    }
    return fired;
  }

  async pendingCount(): Promise<number> {
    return this.store.pendingCount();
  }
}
