// ─────────────────────────────────────────────────────────────────────────────
// InMemoryConversationGateway — gateway que REGISTRA tudo (texto, presença,
// reação, leitura) em ordem, sem rede. Serve a testes e ao modo local/echo.
// Registra a SEQUÊNCIA de ações para provar as garantias humanas (ex.: houve
// "composing" antes de todo envio).
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationGateway, OutboundReceipt, PresenceState } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';

export type GatewayAction =
  | { readonly type: 'text'; readonly chatId: string; readonly text: string; readonly at: Date }
  | { readonly type: 'presence'; readonly chatId: string; readonly state: PresenceState; readonly at: Date }
  | { readonly type: 'reaction'; readonly chatId: string; readonly messageId: string; readonly emoji: string; readonly at: Date }
  | { readonly type: 'read'; readonly chatId: string; readonly messageId: string; readonly at: Date };

export class InMemoryConversationGateway implements ConversationGateway {
  private readonly log: GatewayAction[] = [];
  private counter = 0;

  constructor(private readonly clock: Clock) {}

  sendText(chatId: string, text: string): Promise<OutboundReceipt> {
    this.log.push({ type: 'text', chatId, text, at: this.clock.now() });
    this.counter += 1;
    return Promise.resolve({ providerMessageId: `out-${String(this.counter)}`, sentAt: this.clock.now() });
  }

  setPresence(chatId: string, state: PresenceState): Promise<void> {
    this.log.push({ type: 'presence', chatId, state, at: this.clock.now() });
    return Promise.resolve();
  }

  sendReaction(chatId: string, messageId: string, emoji: string): Promise<void> {
    this.log.push({ type: 'reaction', chatId, messageId, emoji, at: this.clock.now() });
    return Promise.resolve();
  }

  markRead(chatId: string, messageId: string): Promise<void> {
    this.log.push({ type: 'read', chatId, messageId, at: this.clock.now() });
    return Promise.resolve();
  }

  actions(): readonly GatewayAction[] {
    return [...this.log];
  }

  texts(): readonly string[] {
    return this.log.filter((a): a is Extract<GatewayAction, { type: 'text' }> => a.type === 'text').map((a) => a.text);
  }
}
