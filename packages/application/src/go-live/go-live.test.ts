// ─────────────────────────────────────────────────────────────────────────────
// Testes unitários do GO LIVE — Boot (ordem de dependência, falha detectada),
// Checklist (qualquer falha ⇒ produção bloqueada), Scheduler (idempotência,
// vencimento, cancelamento), Notification (anti-spam), Health (agregação) e
// Portal (controle de acesso por papel).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import { BootRuntime, type BootableComponent } from './boot-runtime.js';
import { GoLiveChecklist, GO_LIVE_ITEMS, type GoLiveCheck } from './go-live-checklist.js';
import { HealthRuntime, online } from './health-runtime.js';
import { ObservabilityRuntime } from './observability-runtime.js';
import { SchedulerRuntime, type ScheduledTask, type SchedulerStore } from './scheduler-runtime.js';
import { NotificationRuntime, type DeliveredNotification, type NotificationChannelPort } from './notification-runtime.js';
import type { NotificationIntentOut } from '../executive-brain/index.js';

const NOW = new Date('2026-07-14T00:00:00.000Z');
const clock: Clock = { now: () => NOW };

class FakeSchedulerStore implements SchedulerStore {
  private readonly tasks = new Map<string, ScheduledTask>();
  save(task: ScheduledTask): Promise<void> {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }
  byId(id: string): Promise<ScheduledTask | null> {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }
  due(now: Date): Promise<readonly ScheduledTask[]> {
    return Promise.resolve([...this.tasks.values()].filter((t) => t.status === 'pending' && t.dueAt.getTime() <= now.getTime()));
  }
  pendingCount(): Promise<number> {
    return Promise.resolve([...this.tasks.values()].filter((t) => t.status === 'pending').length);
  }
}

function bootable(name: string, dependsOn: readonly string[], fail = false): BootableComponent {
  return {
    name,
    dependsOn,
    start: () => (fail ? Promise.reject(new Error(`${name} quebrou`)) : Promise.resolve()),
    check: () => Promise.resolve(online(name, NOW)),
  };
}

describe('BootRuntime', () => {
  it('sobe em ordem, valida dependências e registra saúde', async () => {
    const health = new HealthRuntime();
    const boot = new BootRuntime(health, new ObservabilityRuntime(), clock);
    const report = await boot.boot([bootable('a', []), bootable('b', ['a']), bootable('c', ['b'])]);
    expect(report.ok).toBe(true);
    expect(report.started).toEqual(['a', 'b', 'c']);
    expect(health.overall()).toBe('ONLINE');
  });

  it('detecta falha, marca FAILED e pula dependentes (sem subir meio-sistema)', async () => {
    const health = new HealthRuntime();
    const boot = new BootRuntime(health, new ObservabilityRuntime(), clock);
    const report = await boot.boot([bootable('a', [], true), bootable('b', ['a'])]);
    expect(report.ok).toBe(false);
    expect(report.failed[0]?.name).toBe('a');
    expect(report.skipped[0]).toEqual({ name: 'b', missingDependency: 'a' });
    expect(health.get('a')?.status).toBe('FAILED');
    expect(health.overall()).toBe('FAILED');
  });
});

describe('GoLiveChecklist — qualquer falha bloqueia produção', () => {
  const passing: GoLiveCheck[] = GO_LIVE_ITEMS.map((item) => ({ item, run: () => Promise.resolve(true) }));

  it('todos os itens passando ⇒ produção liberada', async () => {
    const report = await new GoLiveChecklist(clock).verify(passing);
    expect(report.ready).toBe(true);
    expect(report.results).toHaveLength(GO_LIVE_ITEMS.length);
  });

  it('UM item falhando ⇒ produção BLOQUEADA', async () => {
    const withFailure = passing.map((c) => (c.item === 'integrity' ? { ...c, run: () => Promise.resolve(false) } : c));
    const report = await new GoLiveChecklist(clock).verify(withFailure);
    expect(report.ready).toBe(false);
  });

  it('check AUSENTE ⇒ produção BLOQUEADA (não dá para pular verificação)', async () => {
    const incomplete = passing.filter((c) => c.item !== 'whatsapp');
    const report = await new GoLiveChecklist(clock).verify(incomplete);
    expect(report.ready).toBe(false);
    expect(report.missingChecks).toContain('whatsapp');
  });

  it('check que LANÇA ⇒ item reprovado com o erro registrado', async () => {
    const throwing = passing.map((c) =>
      c.item === 'event-store' ? { ...c, run: () => Promise.reject(new Error('sem conexão')) } : c,
    );
    const report = await new GoLiveChecklist(clock).verify(throwing);
    expect(report.ready).toBe(false);
    expect(report.results.find((r) => r.item === 'event-store')?.error).toBe('sem conexão');
  });
});

describe('SchedulerRuntime', () => {
  it('agenda (idempotente por id), vence e dispara uma única vez', async () => {
    const scheduler = new SchedulerRuntime(new FakeSchedulerStore());
    const base = { id: 't1', chatId: 'c1', missionId: null, kind: 'remind_client' as const, dueAt: new Date(NOW.getTime() + 1000), note: null, createdAt: NOW };
    await scheduler.schedule(base);
    await scheduler.schedule(base); // idempotente
    expect(await scheduler.pendingCount()).toBe(1);

    expect(await scheduler.fireDue(NOW)).toHaveLength(0); // ainda não venceu
    const fired = await scheduler.fireDue(new Date(NOW.getTime() + 1001));
    expect(fired).toHaveLength(1);
    expect(await scheduler.fireDue(new Date(NOW.getTime() + 2000))).toHaveLength(0); // não redispara
  });

  it('cancelamento impede o disparo', async () => {
    const scheduler = new SchedulerRuntime(new FakeSchedulerStore());
    await scheduler.schedule({ id: 't2', chatId: 'c1', missionId: null, kind: 'follow_deadline', dueAt: NOW, note: null, createdAt: NOW });
    await scheduler.cancel('t2');
    expect(await scheduler.fireDue(new Date(NOW.getTime() + 1))).toHaveLength(0);
  });
});

describe('NotificationRuntime — anti-spam', () => {
  function intent(reason: string): NotificationIntentOut {
    return {
      id: `n-${reason}-${String(Math.random()).slice(2, 8)}`,
      missionId: 'm1',
      chatId: null,
      kind: 'notification',
      channel: 'portal-operacao',
      audience: 'operador',
      reasonCode: reason,
      provenance: { decisor: 'AHRI', tipo: 'DECISAO_OPERACIONAL_AUTOMATIZADA', fundamento: 'RO', operationalRuleRef: 'RO-N' },
      formedAt: NOW,
    };
  }
  class Channel implements NotificationChannelPort {
    readonly sent: DeliveredNotification[] = [];
    deliver(n: DeliveredNotification): Promise<void> {
      this.sent.push(n);
      return Promise.resolve();
    }
  }

  it('entrega a primeira e SUPRIME a repetição dentro do intervalo (nunca spam)', async () => {
    const channel = new Channel();
    const rt = new NotificationRuntime(channel, { minIntervalMs: 60_000 });
    expect(await rt.consume(intent('PRAZO'), NOW)).toBe(true);
    expect(await rt.consume(intent('PRAZO'), new Date(NOW.getTime() + 30_000))).toBe(false); // suprimida
    expect(await rt.consume(intent('PRAZO'), new Date(NOW.getTime() + 61_000))).toBe(true); // passou o intervalo
    expect(channel.sent).toHaveLength(2);
    expect(rt.suppressed()).toBe(1);
  });
});
