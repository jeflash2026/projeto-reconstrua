// ─────────────────────────────────────────────────────────────────────────────
// TEMPORAL SIGNAL DISPATCHER — converte tarefas VENCIDAS do Scheduler em SINAIS
// TEMPORAIS (envelopes de percepção) e os entrega ao Conversation Runtime (2B),
// cujo fluxo leva ao Executive Brain — QUE DECIDE o que fazer (falar/esperar/
// cobrar). O dispatcher não decide nada: só transporta o tempo até a percepção.
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationRuntime, InboundEnvelope, TurnResult } from '../conversation/index.js';
import type { ScheduledTask, SchedulerRuntime } from './scheduler-runtime.js';

function toTemporalEnvelope(task: ScheduledTask, now: Date): InboundEnvelope {
  return {
    messageId: `sched:${task.id}`,
    chatId: task.chatId,
    from: task.chatId,
    kind: 'timeout',
    text: null,
    mediaUrl: null,
    mediaMimeType: null,
    fileName: null,
    location: null,
    contact: null,
    reactionEmoji: null,
    reactionToMessageId: null,
    editedText: null,
    deletedMessageId: null,
    silenceMs: Math.max(0, now.getTime() - task.createdAt.getTime()),
    timestamp: now,
  };
}

export class TemporalSignalDispatcher {
  constructor(
    private readonly scheduler: SchedulerRuntime,
    private readonly conversation: ConversationRuntime,
  ) {}

  /** Um tick de produção: dispara as vencidas e entrega cada sinal à percepção. */
  async tick(now: Date): Promise<readonly TurnResult[]> {
    const fired = await this.scheduler.fireDue(now);
    const results: TurnResult[] = [];
    for (const task of fired) {
      results.push(await this.conversation.onTemporalTrigger(toTemporalEnvelope(task, now), now));
    }
    return results;
  }
}
