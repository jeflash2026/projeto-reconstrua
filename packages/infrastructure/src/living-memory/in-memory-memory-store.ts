// ─────────────────────────────────────────────────────────────────────────────
// InMemoryMemoryStore — persistência in-memory da Memória Viva (por chatId). O
// adapter Postgres entra sem tocar o runtime (mesmo port).
// ─────────────────────────────────────────────────────────────────────────────
import type { ClientMemory, MemoryStore } from '@reconstrua/application';

export class InMemoryMemoryStore implements MemoryStore {
  private readonly byChat = new Map<string, ClientMemory>();

  load(chatId: string): Promise<ClientMemory | null> {
    return Promise.resolve(this.byChat.get(chatId) ?? null);
  }
  save(memory: ClientMemory): Promise<void> {
    this.byChat.set(memory.chatId, memory);
    return Promise.resolve();
  }
  all(): Promise<readonly ClientMemory[]> {
    return Promise.resolve([...this.byChat.values()]);
  }
}
