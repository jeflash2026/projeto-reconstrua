// ─────────────────────────────────────────────────────────────────────────────
// E2E do GO LIVE — a OPERAÇÃO REAL, ponta a ponta, sem simulação de fluxo:
//   WhatsApp → Perception → Brain → Mission → Event Store → Dispatcher →
//   Read Models → Memória → Relationship → Conversation → Cliente
// + Boot, Checklist (bloqueio), Workflow→Scheduler→sinal temporal→Brain,
// Handoff e Portais (acesso por papel).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { EscalationIntentOut, InboundEnvelope, NotificationIntentOut } from '@reconstrua/application';
import { InMemoryConversationGateway } from '../conversation/in-memory-conversation-gateway.js';
import { FakeSleeper } from '../conversation/system-sleeper.js';
import { assembleGoLive } from './build-go-live.js';

const T0 = new Date('2026-07-14T00:00:00.000Z');
const CHAT = '5511999999999@s.whatsapp.net';

class TestClock implements Clock {
  private t = new Date(T0.getTime());
  now(): Date {
    return new Date(this.t.getTime());
  }
  advance(ms: number): void {
    this.t = new Date(this.t.getTime() + ms);
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

function envelope(text: string, messageId: string): InboundEnvelope {
  return {
    messageId,
    chatId: CHAT,
    from: CHAT,
    kind: 'text',
    text,
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
    timestamp: T0,
  };
}

function harness() {
  const clock = new TestClock();
  const gateway = new InMemoryConversationGateway(clock);
  const live = assembleGoLive({ clock, uuid: new SeqUuid(), gateway, sleeper: new FakeSleeper(clock), rng: () => 0.5 });
  return { live, clock, gateway };
}

describe('GO LIVE — boot e checklist', () => {
  it('boot sobe todos os runtimes em ordem e a saúde global fica ONLINE', async () => {
    const { live } = harness();
    const report = await live.boot.boot(live.bootComponents);
    expect(report.ok).toBe(true);
    expect(report.failed).toHaveLength(0);
    expect(report.skipped).toHaveLength(0);
    expect(live.health.overall()).toBe('ONLINE');
  });

  it('checklist completo passa (18 itens) ⇒ produção liberada', async () => {
    const { live } = harness();
    await live.boot.boot(live.bootComponents);
    const report = await live.checklist.verify(live.checks);
    expect(report.results).toHaveLength(18);
    expect(report.missingChecks).toHaveLength(0);
    expect(report.ready).toBe(true);
  });
});

describe('GO LIVE — o fluxo obrigatório completo num turno real', () => {
  it('"Olá" no WhatsApp → missão criada, read models projetados, memória viva, resposta entregue', async () => {
    const { live, gateway } = harness();
    await live.boot.boot(live.bootComponents);

    const result = await live.conversation.receive(envelope('olá, meu nome é João', 'M1'));

    // Brain decidiu; Conversa respondeu ao cliente (com humanização).
    expect(result.skipped).toBe(false);
    expect(gateway.texts().length).toBeGreaterThanOrEqual(1);

    // Mission executou: eventos de domínio no Event Store (mission stream nasceu).
    const all = await live.eventStore.readAll(0, 100);
    expect(all.some((e) => e.eventType === 'mission.created')).toBe(true);
    expect(all.every((e) => e.provenance.actor === 'AHRI' || e.provenance.actor === null)).toBe(true);

    // Dispatcher drenou → Read Models projetados (CQRS).
    const metrics = await live.metricsStore.load();
    expect(metrics?.clientCount).toBe(1);
    expect(metrics?.missionCount).toBe(1);

    // Workflow acompanhou e agendou o follow-up automático.
    const missionEvent = all.find((e) => e.eventType === 'mission.created');
    const progress = await live.workflow.progress(missionEvent?.streamId ?? '');
    expect(progress?.steps).toContain('acompanhamento');
    expect(await live.scheduler.pendingCount()).toBeGreaterThanOrEqual(1);

    // Memória viva lembra do cliente (atributo com fonte).
    const memory = await live.memoryStore.load(CHAT);
    expect(memory?.messageCount).toBe(1);
    expect(memory?.attributes.some((a) => a.key === 'name' && a.value.toLowerCase().includes('joão'))).toBe(true);
  });

  it('sinal temporal do Scheduler → Brain decide (com Regra Operacional) → sem mensagem mecânica', async () => {
    const { live, clock, gateway } = harness();
    await live.boot.boot(live.bootComponents);
    await live.conversation.receive(envelope('olá', 'M1'));
    const textsAfterHello = gateway.texts().length;

    // Vence o follow-up agendado pelo Workflow (3 dias) e o tempo chega ao Brain.
    clock.advance(4 * 24 * 60 * 60_000);
    const results = await live.temporal.tick(clock.now());

    expect(results.length).toBeGreaterThanOrEqual(1);
    // A decisão veio do Brain com Regra Operacional (wait default do catálogo 2D) —
    // silêncio ativo: NENHUMA mensagem mecânica disparada.
    expect(results[0]?.intents[0]?.operationalRuleRef).toMatch(/^RO-/);
    expect(gateway.texts().length).toBe(textsAfterHello);
    // A tarefa disparou uma única vez.
    expect(await live.temporal.tick(clock.now())).toHaveLength(0);
  });
});

describe('GO LIVE — handoff e portais (acesso por papel)', () => {
  function escalation(role: EscalationIntentOut['role']): EscalationIntentOut {
    return {
      id: `00000000-0000-4000-8000-0000000000e${role.length}`,
      kind: 'escalation',
      missionId: 'm1',
      chatId: CHAT,
      role,
      reasonCode: 'COMPETENCIA_HUMANA',
      provenance: { decisor: 'AHRI', tipo: 'DECISAO_OPERACIONAL_AUTOMATIZADA', fundamento: 'DF-09', operationalRuleRef: 'RO-2D-ESCALATE-HUMAN' },
      formedAt: T0,
    };
  }

  it('escalação do Brain → tarefa encaminhada ao papel certo (idempotente); a AHRI só encaminha', async () => {
    const { live } = harness();
    const intent = escalation('advogado');
    const task = await live.handoff.consume(intent);
    await live.handoff.consume(intent); // idempotente
    expect(task.role).toBe('advogado');
    expect(task.operationalRuleRef).toBe('RO-2D-ESCALATE-HUMAN');
    expect(await live.handoff.openFor('advogado')).toHaveLength(1);
    expect(await live.handoff.openFor('perito')).toHaveLength(0); // papel certo, nunca o errado
  });

  it('portais: cada papel vê SÓ a sua visão (operador nunca vê métricas nem health)', async () => {
    const { live } = harness();
    expect(live.portals.canAccess('administrador', 'metrics')).toBe(true);
    expect(live.portals.canAccess('operador', 'metrics')).toBe(false);
    expect(live.portals.canAccess('advogado', 'health')).toBe(false);
    const operador = await live.portals.view('operador');
    expect(operador.metrics).toBeNull();
    expect(operador.health).toHaveLength(0);
    const admin = await live.portals.view('administrador');
    expect(admin.sections).toContain('metrics');
  });

  it('notificação do Brain é entregue com proveniência e o spam é suprimido', async () => {
    const { live, clock } = harness();
    const intent: NotificationIntentOut = {
      id: '00000000-0000-4000-8000-0000000000aa',
      kind: 'notification' as const,
      missionId: 'm1',
      chatId: null,
      channel: 'portal-operacao',
      audience: 'operador',
      reasonCode: 'PRAZO_CRITICO',
      provenance: { decisor: 'AHRI', tipo: 'DECISAO_OPERACIONAL_AUTOMATIZADA', fundamento: 'RO-R6', operationalRuleRef: 'RO-2D-NOTIFY' },
      formedAt: T0,
    };
    expect(await live.notification.consume(intent, clock.now())).toBe(true);
    expect(await live.notification.consume(intent, clock.now())).toBe(false); // suprimida (anti-spam)
    expect(live.notificationChannel.delivered()[0]?.operationalRuleRef).toBe('RO-2D-NOTIFY');
  });
});
