// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE QUEUE RUNTIME — fila de saída ORDENADA por conversa (FIFO por chatId).
//
// Garante ordem e NÃO-sobreposição: a AHRI nunca "atropela" a própria fala nem
// envia duas mensagens ao mesmo tempo. Rajadas viram sequência ordenada. O envio
// efetivo (com timing humano) é feito pelo Delivery Runtime consumindo esta fila.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { MessageQueueStore, QueuedMessage } from './ports.js';

export class MessageQueueRuntime {
  constructor(
    private readonly store: MessageQueueStore,
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
  ) {}

  async enqueue(chatId: string, intentId: string, text: string): Promise<QueuedMessage> {
    return this.store.enqueue({
      id: this.uuid.next(),
      chatId,
      intentId,
      text,
      enqueuedAt: this.clock.now(),
    });
  }

  async nextPending(chatId: string): Promise<QueuedMessage | null> {
    return this.store.nextPending(chatId);
  }

  async markSent(id: string): Promise<void> {
    await this.store.markSent(id);
  }

  async pendingCount(chatId: string): Promise<number> {
    return this.store.pendingCount(chatId);
  }
}
