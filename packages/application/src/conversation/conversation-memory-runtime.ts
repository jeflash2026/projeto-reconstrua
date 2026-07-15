// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MEMORY RUNTIME — a memória da conversa (log de INTEGRAÇÃO).
//
// Registra entrada, percepção, INTENÇÃO (com proveniência), e saída — para que a
// AHRI soe contínua ("lembra de você") e para AUDITORIA. NÃO é o Event Store de
// domínio: não grava eventos de domínio, não altera Verdade. É append-only lógico
// (só acrescenta; nada apaga).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { ConversationIntent } from './intent.js';
import type { InboundEnvelope, Percept } from './percept.js';
import type { ConversationStore, MemoryEntry } from './ports.js';

export class ConversationMemoryRuntime {
  constructor(
    private readonly store: ConversationStore,
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
  ) {}

  private base(chatId: string): Pick<MemoryEntry, 'id' | 'chatId' | 'at'> {
    return { id: this.uuid.next(), chatId, at: this.clock.now() };
  }

  async recordInbound(envelope: InboundEnvelope): Promise<void> {
    await this.store.append({
      ...this.base(envelope.chatId),
      kind: 'inbound',
      text: envelope.text ?? envelope.editedText,
      intentDirective: null,
      operationalRuleRef: null,
      meta: { messageId: envelope.messageId, perceptKind: envelope.kind },
    });
  }

  async recordPercept(percept: Percept): Promise<void> {
    const summary = percept.enrichment?.summary ?? null;
    await this.store.append({
      ...this.base(percept.envelope.chatId),
      kind: 'percept',
      text: summary,
      intentDirective: null,
      operationalRuleRef: null,
      meta: { perceptId: percept.id, perceptKind: percept.envelope.kind },
    });
  }

  /** Registra a INTENÇÃO decidida pelo Brain, com sua proveniência (INV-AH-02). */
  async recordIntent(intent: ConversationIntent): Promise<void> {
    await this.store.append({
      ...this.base(intent.chatId),
      kind: 'intent',
      text: intent.topic,
      intentDirective: intent.directive,
      operationalRuleRef: intent.operationalRuleRef,
      meta: {
        intentId: intent.id,
        ...(intent.speechAct ? { speechAct: intent.speechAct } : {}),
        ...(intent.fundamento ? { fundamento: intent.fundamento } : {}),
      },
    });
  }

  async recordOutbound(chatId: string, text: string, providerMessageId: string): Promise<void> {
    await this.store.append({
      ...this.base(chatId),
      kind: 'outbound',
      text,
      intentDirective: null,
      operationalRuleRef: null,
      meta: { providerMessageId },
    });
  }

  async recordNote(chatId: string, note: string): Promise<void> {
    await this.store.append({
      ...this.base(chatId),
      kind: 'note',
      text: note,
      intentDirective: null,
      operationalRuleRef: null,
      meta: {},
    });
  }

  async recent(chatId: string, limit: number): Promise<readonly MemoryEntry[]> {
    return this.store.recent(chatId, limit);
  }

  async recentOutboundTexts(chatId: string, limit: number): Promise<readonly string[]> {
    return this.store.recentOutboundTexts(chatId, limit);
  }

  async alreadySeen(chatId: string, providerMessageId: string): Promise<boolean> {
    return this.store.hasInbound(chatId, providerMessageId);
  }
}
