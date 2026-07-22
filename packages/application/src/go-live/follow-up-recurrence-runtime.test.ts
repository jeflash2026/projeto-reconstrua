// ─────────────────────────────────────────────────────────────────────────────
// Testes do FollowUpRecurrenceRuntime (B4.2) — recorrência CONTROLADA:
//   • acompanhamento decidido (RO-4C-*) ⇒ agenda o PRÓXIMO na cadência, streak++;
//   • encerrado (STOP) / escalação / espera ⇒ NÃO recorre (cadeia termina);
//   • teto anti-spam: além de `maxConsecutive` nudges consecutivos ⇒ NÃO recorre;
//   • ids encadeiam determinística e unicamente (sem loop no mesmo instante).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { TurnResult } from '../conversation/conversation-runtime.js';
import type { ConversationIntent } from '../conversation/intent.js';
import type { ScheduledTask, SchedulerStore } from './scheduler-runtime.js';
import { SchedulerRuntime } from './scheduler-runtime.js';
import {
  FollowUpRecurrenceRuntime,
  DEFAULT_FOLLOW_UP_RECURRENCE,
} from './follow-up-recurrence-runtime.js';

class MemoryScheduler implements SchedulerStore {
  readonly tasks = new Map<string, ScheduledTask>();
  save(task: ScheduledTask): Promise<void> {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }
  byId(id: string): Promise<ScheduledTask | null> {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }
  due(now: Date): Promise<readonly ScheduledTask[]> {
    return Promise.resolve(
      [...this.tasks.values()].filter((t) => t.status === 'pending' && t.dueAt <= now),
    );
  }
  pendingCount(): Promise<number> {
    return Promise.resolve([...this.tasks.values()].filter((t) => t.status === 'pending').length);
  }
  all(): Promise<readonly ScheduledTask[]> {
    return Promise.resolve([...this.tasks.values()]);
  }
}

const NOW = new Date('2026-07-14T09:00:00.000Z');

function task(over: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 'wf:E1:remind_client',
    chatId: '5511@x',
    missionId: 'M1',
    kind: 'remind_client',
    dueAt: NOW,
    note: 'workflow',
    createdAt: NOW,
    status: 'fired',
    ...over,
  };
}

function intent(operationalRuleRef: string | null): ConversationIntent {
  return {
    id: 'i1',
    chatId: '5511@x',
    directive: 'speak',
    speechAct: 'follow_up',
    topic: null,
    references: [],
    urgency: 'normal',
    operationalRuleRef,
    fundamento: null,
    timingHintMs: null,
    formedAt: NOW,
  };
}

function result(refs: Array<string | null>): TurnResult {
  return {
    chatId: '5511@x',
    percept: null,
    intents: refs.map(intent),
    delivered: [],
    skipped: false,
  };
}

describe('FollowUpRecurrenceRuntime (B4.2)', () => {
  it('acompanhamento decidido (RO-4C-FOLLOWUP-TIMEOUT) ⇒ agenda o próximo na cadência (streak 1)', async () => {
    const store = new MemoryScheduler();
    const rec = new FollowUpRecurrenceRuntime(new SchedulerRuntime(store));
    await rec.onFollowUpFired(task(), result(['RO-4C-FOLLOWUP-TIMEOUT']), NOW);

    const next = store.tasks.get('wf:E1:remind_client#1');
    expect(next).toBeDefined();
    expect(next?.status).toBe('pending');
    expect(next?.chatId).toBe('5511@x');
    expect(next?.kind).toBe('remind_client');
    expect(next?.dueAt.getTime()).toBe(NOW.getTime() + DEFAULT_FOLLOW_UP_RECURRENCE.cadenceMs);
  });

  it('encerrado (STOP / RO-STOP-CONCLUDED-001) ⇒ NÃO recorre (processo encerrado fica silencioso)', async () => {
    const store = new MemoryScheduler();
    const rec = new FollowUpRecurrenceRuntime(new SchedulerRuntime(store));
    await rec.onFollowUpFired(task(), result(['RO-STOP-CONCLUDED-001']), NOW);
    expect(await store.pendingCount()).toBe(0);
  });

  it('escalação/espera (sem RO-4C-*) ⇒ NÃO recorre', async () => {
    const store = new MemoryScheduler();
    const rec = new FollowUpRecurrenceRuntime(new SchedulerRuntime(store));
    await rec.onFollowUpFired(task(), result(['RO-2D-ESCALATE-HUMAN']), NOW);
    await rec.onFollowUpFired(task(), result([null]), NOW);
    expect(await store.pendingCount()).toBe(0);
  });

  it('encadeia streak a streak até o teto anti-spam e então PARA', async () => {
    const store = new MemoryScheduler();
    const rec = new FollowUpRecurrenceRuntime(new SchedulerRuntime(store), {
      cadenceMs: 1000,
      maxConsecutive: 3,
    });
    // streak 0 → agenda #1; #1 → #2; #2 → (next=3 >= 3) PARA.
    await rec.onFollowUpFired(task({ id: 'base' }), result(['RO-4C-FOLLOWUP-SILENCE']), NOW);
    expect(store.tasks.get('base#1')).toBeDefined();
    await rec.onFollowUpFired(task({ id: 'base#1' }), result(['RO-4C-FOLLOWUP-SILENCE']), NOW);
    expect(store.tasks.get('base#2')).toBeDefined();
    await rec.onFollowUpFired(task({ id: 'base#2' }), result(['RO-4C-FOLLOWUP-SILENCE']), NOW);
    expect(store.tasks.get('base#3')).toBeUndefined(); // teto: não passa de maxConsecutive
    expect(await store.pendingCount()).toBe(2); // #1 e #2 apenas
  });

  it('é idempotente por id (reprocessar o mesmo disparo não duplica a próxima ocorrência)', async () => {
    const store = new MemoryScheduler();
    const rec = new FollowUpRecurrenceRuntime(new SchedulerRuntime(store));
    await rec.onFollowUpFired(task(), result(['RO-4C-FOLLOWUP-TIMEOUT']), NOW);
    await rec.onFollowUpFired(task(), result(['RO-4C-FOLLOWUP-TIMEOUT']), NOW);
    expect(await store.pendingCount()).toBe(1);
  });
});
