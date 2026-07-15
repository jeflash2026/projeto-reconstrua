// ─────────────────────────────────────────────────────────────────────────────
// InMemoryMessageQueueStore — fila de saída FIFO por conversa. O store atribui um
// `seq` monotônico por chatId (ordem de inserção); `nextPending` devolve a
// pendente de MENOR seq → ordem preservada, sem sobreposição.
// ─────────────────────────────────────────────────────────────────────────────
import type { EnqueueInput, MessageQueueStore, QueuedMessage } from '@reconstrua/application';

interface MutableQueued {
  id: string;
  chatId: string;
  seq: number;
  intentId: string;
  text: string;
  enqueuedAt: Date;
  status: 'pending' | 'sent';
}

export class InMemoryMessageQueueStore implements MessageQueueStore {
  private readonly messages = new Map<string, MutableQueued>();
  private readonly seqByChat = new Map<string, number>();

  enqueue(input: EnqueueInput): Promise<QueuedMessage> {
    const seq = (this.seqByChat.get(input.chatId) ?? 0) + 1;
    this.seqByChat.set(input.chatId, seq);
    const msg: MutableQueued = {
      id: input.id,
      chatId: input.chatId,
      seq,
      intentId: input.intentId,
      text: input.text,
      enqueuedAt: input.enqueuedAt,
      status: 'pending',
    };
    this.messages.set(msg.id, msg);
    return Promise.resolve({ ...msg });
  }

  nextPending(chatId: string): Promise<QueuedMessage | null> {
    let best: MutableQueued | null = null;
    for (const msg of this.messages.values()) {
      if (msg.chatId !== chatId || msg.status !== 'pending') continue;
      if (!best || msg.seq < best.seq) best = msg;
    }
    return Promise.resolve(best ? { ...best } : null);
  }

  markSent(id: string): Promise<void> {
    const msg = this.messages.get(id);
    if (msg) msg.status = 'sent';
    return Promise.resolve();
  }

  pendingCount(chatId: string): Promise<number> {
    let count = 0;
    for (const msg of this.messages.values()) {
      if (msg.chatId === chatId && msg.status === 'pending') count += 1;
    }
    return Promise.resolve(count);
  }
}
