// ─────────────────────────────────────────────────────────────────────────────
// MEMORY NOTE WRITER — a ponte (aditiva) entre a Memória Viva e a Conversa (2B).
// Escreve um resumo de continuidade como NOTA no ConversationStore (port público de
// 2B) — daí ela entra no contexto recente que alimenta o fraseado da Conversa. Não
// altera 2B; usa apenas o `append` que já existe. A memória, assim, "chega" à fala.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { ConversationStore } from '../conversation/index.js';
import type { RelationshipRuntime } from './relationship-runtime.js';

export class MemoryNoteWriter {
  constructor(
    private readonly conversationStore: ConversationStore,
    private readonly relationship: RelationshipRuntime,
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
  ) {}

  /** Injeta o contexto de continuidade como nota, para o fraseado lembrar do cliente. */
  async inject(chatId: string): Promise<void> {
    const context = await this.relationship.context(chatId);
    await this.conversationStore.append({
      id: this.uuid.next(),
      chatId,
      kind: 'note',
      at: this.clock.now(),
      text: context.summary,
      intentDirective: null,
      operationalRuleRef: null,
      meta: { source: 'living-memory' },
    });
  }
}
