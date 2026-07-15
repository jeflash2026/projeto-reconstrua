// ─────────────────────────────────────────────────────────────────────────────
// InMemoryConversationStore — memória de conversa append-only (log de INTEGRAÇÃO,
// NÃO o Event Store de domínio). Guarda entrada/percepção/intenção/saída/nota e
// garante idempotência de entrada por (chatId, providerMessageId).
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationStore, MemoryEntry } from '@reconstrua/application';

export class InMemoryConversationStore implements ConversationStore {
  private readonly entries: MemoryEntry[] = [];
  private readonly inboundIds = new Set<string>();

  private key(chatId: string, messageId: string): string {
    return `${chatId}|${messageId}`;
  }

  append(entry: MemoryEntry): Promise<void> {
    this.entries.push(entry);
    if (entry.kind === 'inbound') {
      const messageId = entry.meta['messageId'];
      if (messageId !== undefined) this.inboundIds.add(this.key(entry.chatId, messageId));
    }
    return Promise.resolve();
  }

  recent(chatId: string, limit: number): Promise<readonly MemoryEntry[]> {
    const forChat = this.entries.filter((e) => e.chatId === chatId);
    return Promise.resolve(forChat.slice(Math.max(0, forChat.length - limit)));
  }

  recentOutboundTexts(chatId: string, limit: number): Promise<readonly string[]> {
    const texts: string[] = [];
    for (let i = this.entries.length - 1; i >= 0 && texts.length < limit; i -= 1) {
      const e = this.entries[i];
      if (e && e.chatId === chatId && e.kind === 'outbound' && e.text !== null) {
        texts.push(e.text);
      }
    }
    return Promise.resolve(texts);
  }

  lastInboundAt(chatId: string): Promise<Date | null> {
    let last: Date | null = null;
    for (const e of this.entries) {
      if (e.chatId === chatId && e.kind === 'inbound') last = e.at;
    }
    return Promise.resolve(last);
  }

  hasInbound(chatId: string, providerMessageId: string): Promise<boolean> {
    return Promise.resolve(this.inboundIds.has(this.key(chatId, providerMessageId)));
  }

  /** Introspecção para testes/observabilidade. */
  all(): readonly MemoryEntry[] {
    return [...this.entries];
  }
}
