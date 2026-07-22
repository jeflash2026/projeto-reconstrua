// ─────────────────────────────────────────────────────────────────────────────
// ProductionIngress.tick — RESILIÊNCIA da varredura (caso Rosana, 2026-07-22).
// A varredura (retomada de conversas caídas + SLA) DEVE rodar em todo tick,
// mesmo que o processamento dos agendamentos falhe. Antes, uma falha ali
// abortava o tick e a retomada nunca rodava para NINGUÉM.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type {
  ConversationRuntime,
  InboundEnvelope,
  ScheduledTask,
  SchedulerRuntime,
  TurnResult,
} from '@reconstrua/application';
import { ProductionIngress } from './production-ingress.js';

const NOW = new Date('2026-07-22T14:00:00.000Z');

function conversationDouble(): ConversationRuntime {
  const skip = (chatId: string): TurnResult => ({
    chatId,
    percept: null,
    intents: [],
    delivered: [],
    skipped: true,
  });
  return {
    receive: (e: InboundEnvelope) => Promise.resolve(skip(e.chatId)),
    onTemporalTrigger: (e: InboundEnvelope) => Promise.resolve(skip(e.chatId)),
  } as unknown as ConversationRuntime;
}

function schedulerQueLanca(): SchedulerRuntime {
  return {
    fireDue: () => Promise.reject(new Error('agendamento explodiu')),
  } as unknown as SchedulerRuntime;
}

function schedulerComTarefaRuim(task: ScheduledTask): SchedulerRuntime {
  return {
    fireDue: () => Promise.resolve([task]),
  } as unknown as SchedulerRuntime;
}

describe('ProductionIngress.tick — a varredura roda SEMPRE', () => {
  it('fireDue LANÇA ⇒ a varredura ainda roda', async () => {
    let varreu = false;
    const ingress = new ProductionIngress(
      conversationDouble(),
      schedulerQueLanca(),
      () => null,
      undefined,
      {
        aoReceberTexto: () => Promise.resolve(),
        varredura: () => {
          varreu = true;
          return Promise.resolve();
        },
      },
    );
    await ingress.tick(NOW);
    expect(varreu).toBe(true);
  });

  it('uma TAREFA problemática (onTemporalTrigger lança) não bloqueia a varredura', async () => {
    let varreu = false;
    const conversation = {
      receive: (e: InboundEnvelope) => Promise.resolve({ chatId: e.chatId } as TurnResult),
      onTemporalTrigger: () => Promise.reject(new Error('turno temporal explodiu')),
    } as unknown as ConversationRuntime;
    const task = {
      id: 't1',
      chatId: '5511@s.whatsapp.net',
      missionId: null,
      createdAt: NOW,
    } as unknown as ScheduledTask;
    const ingress = new ProductionIngress(
      conversation,
      schedulerComTarefaRuim(task),
      () => null,
      undefined,
      {
        aoReceberTexto: () => Promise.resolve(),
        varredura: () => {
          varreu = true;
          return Promise.resolve();
        },
      },
    );
    await ingress.tick(NOW);
    expect(varreu).toBe(true);
  });
});
