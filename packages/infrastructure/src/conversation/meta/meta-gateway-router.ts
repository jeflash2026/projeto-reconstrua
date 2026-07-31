// ─────────────────────────────────────────────────────────────────────────────
// META GATEWAY ROUTER (decreto 2026-07-31) — a SAÍDA escolhe o carteiro pelo
// canal em que o cliente está: chats registrados como 'meta' (o cliente
// escreveu no número OFICIAL) saem pela Meta Cloud API; todo o resto segue
// intocado ao gateway interno (Evolution/in-memory). Mesmo padrão do
// WebchatGatewayRouter: o pipeline inteiro permanece agnóstico de canal.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AnexoParaAssinatura,
  ConversationGateway,
  EnviadorDeDocumento,
  OutboundReceipt,
  PresenceState,
} from '@reconstrua/application';
import type { CanalDoChatStore } from './meta-canal.js';
import type { MetaCloudGateway } from './meta-cloud-gateway.js';

export class MetaGatewayRouter implements ConversationGateway {
  /** Meta SEMPRE sabe enviar documento; quando o chat é do canal interno, a
   *  capacidade do interno decide (ausente ⇒ no-op — o texto que acompanha
   *  chega, mesma regra do webchat). */
  readonly sendDocument: (
    chatId: string,
    anexo: AnexoParaAssinatura,
    caption: string,
  ) => Promise<void>;

  constructor(
    private readonly inner: ConversationGateway,
    private readonly meta: MetaCloudGateway,
    private readonly canais: Pick<CanalDoChatStore, 'canalDe'>,
  ) {
    const enviadorInterno = (inner as Partial<EnviadorDeDocumento>).sendDocument?.bind(inner);
    this.sendDocument = async (chatId, anexo, caption) => {
      if (await this.viaMeta(chatId)) return this.meta.sendDocument(chatId, anexo, caption);
      return enviadorInterno ? enviadorInterno(chatId, anexo, caption) : undefined;
    };
  }

  private async viaMeta(chatId: string): Promise<boolean> {
    return (await this.canais.canalDe(chatId)) === 'meta';
  }

  async sendText(chatId: string, text: string): Promise<OutboundReceipt> {
    return (await this.viaMeta(chatId))
      ? this.meta.sendText(chatId, text)
      : this.inner.sendText(chatId, text);
  }

  async setPresence(chatId: string, state: PresenceState): Promise<void> {
    return (await this.viaMeta(chatId))
      ? this.meta.setPresence(chatId, state)
      : this.inner.setPresence(chatId, state);
  }

  async sendReaction(chatId: string, messageId: string, emoji: string): Promise<void> {
    return (await this.viaMeta(chatId))
      ? this.meta.sendReaction(chatId, messageId, emoji)
      : this.inner.sendReaction(chatId, messageId, emoji);
  }

  async markRead(chatId: string, messageId: string): Promise<void> {
    return (await this.viaMeta(chatId))
      ? this.meta.markRead(chatId, messageId)
      : this.inner.markRead(chatId, messageId);
  }
}
