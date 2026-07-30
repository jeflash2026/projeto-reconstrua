// ─────────────────────────────────────────────────────────────────────────────
// WEBCHAT GATEWAY ROUTER (decreto 2026-07-30) — a Meta derrubou o WhatsApp do
// dono por "spam"; o atendimento NUNCA mais depende de um único canal.
//
// Conversas do WEBCHAT usam chatId `55…@webchat`. TODO o pipeline (ingress,
// jornada, onboarding, perícia) é agnóstico de canal — o único ponto que fala
// com a Evolution é o gateway. Este router intercepta a SAÍDA: mensagens para
// `@webchat` não vão à Evolution (iriam falhar); elas já ficam registradas na
// memória da conversa (ConversationStore) pelo próprio pipeline, e é de lá que
// a página do webchat lê as respostas da AHRI. Conversas reais de WhatsApp
// seguem intocadas ao gateway interno.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AnexoParaAssinatura,
  ConversationGateway,
  EnviadorDeDocumento,
  OutboundReceipt,
  PresenceState,
} from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';

export const WEBCHAT_SUFFIX = '@webchat';

/** A conversa vive no canal WEB (não há JID de WhatsApp por trás)? */
export function ehChatWeb(chatId: string): boolean {
  return chatId.endsWith(WEBCHAT_SUFFIX);
}

export class WebchatGatewayRouter implements ConversationGateway {
  /** Presente SÓ quando o gateway interno sabe enviar documento (Evolution) —
   *  preserva a detecção de capacidade feita na montagem. No webchat, o anexo
   *  de assinatura não tem transporte (v1): o texto que o acompanha chega. */
  readonly sendDocument?: (
    chatId: string,
    anexo: AnexoParaAssinatura,
    caption: string,
  ) => Promise<void>;

  constructor(
    private readonly inner: ConversationGateway,
    private readonly clock: Clock,
  ) {
    const enviador = inner as Partial<EnviadorDeDocumento>;
    const fn = enviador.sendDocument?.bind(inner);
    if (fn !== undefined) {
      this.sendDocument = (chatId, anexo, caption) =>
        ehChatWeb(chatId) ? Promise.resolve() : fn(chatId, anexo, caption);
    }
  }

  sendText(chatId: string, text: string): Promise<OutboundReceipt> {
    if (ehChatWeb(chatId)) {
      // O pipeline registra o outbound na memória da conversa; a página lê de lá.
      return Promise.resolve({
        providerMessageId: `wc-out-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        sentAt: this.clock.now(),
      });
    }
    return this.inner.sendText(chatId, text);
  }

  setPresence(chatId: string, state: PresenceState): Promise<void> {
    return ehChatWeb(chatId) ? Promise.resolve() : this.inner.setPresence(chatId, state);
  }

  sendReaction(chatId: string, messageId: string, emoji: string): Promise<void> {
    return ehChatWeb(chatId)
      ? Promise.resolve()
      : this.inner.sendReaction(chatId, messageId, emoji);
  }

  markRead(chatId: string, messageId: string): Promise<void> {
    return ehChatWeb(chatId) ? Promise.resolve() : this.inner.markRead(chatId, messageId);
  }
}
