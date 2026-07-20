// ─────────────────────────────────────────────────────────────────────────────
// EVOLUTION GATEWAY — adapter de `ConversationGateway` sobre a Evolution API.
// Traduz as operações de saída (texto, presença, reação, leitura) nas chamadas
// REST da Evolution. Presença "composing/paused" é o "digitando…". Sem lógica de
// conversa: só transporte. HTTP é injetado (testável sem rede).
//
// Endpoints (Evolution API v2):
//   POST /message/sendText/{instance}         { number, text }
//   POST /chat/sendPresence/{instance}        { number, presence, delay }
//   POST /message/sendReaction/{instance}     { key, reaction }
//   POST /chat/markMessageAsRead/{instance}   { readMessages: [key] }
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationGateway, OutboundReceipt, PresenceState } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { HttpClient } from './http-client.js';
import { asString, dig } from '../json.js';

export interface EvolutionConfig {
  readonly baseUrl: string;
  readonly instance: string;
  readonly apiKey: string;
}

/** Evolution usa "available | composing | recording | paused | unavailable". */
function toEvolutionPresence(state: PresenceState): string {
  return state;
}

/** Extrai o número (sem sufixo @s.whatsapp.net) do JID quando presente. */
function toNumber(chatId: string): string {
  const at = chatId.indexOf('@');
  return at === -1 ? chatId : chatId.slice(0, at);
}

export class EvolutionGateway implements ConversationGateway {
  constructor(
    private readonly http: HttpClient,
    private readonly config: EvolutionConfig,
    private readonly clock: Clock,
  ) {}

  private url(path: string): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    return `${base}${path}/${this.config.instance}`;
  }

  private headers(): Readonly<Record<string, string>> {
    return { apikey: this.config.apiKey };
  }

  async sendText(chatId: string, text: string): Promise<OutboundReceipt> {
    const response = await this.http.postJson(this.url('/message/sendText'), this.headers(), {
      number: toNumber(chatId),
      text,
    });
    const providerMessageId = asString(dig(response.body, ['key', 'id'])) ?? '';
    return { providerMessageId, sentAt: this.clock.now() };
  }

  /** Decreto Tráfego Pago · B1 — envia um DOCUMENTO (base64) ao cliente.
   *  Método ADITIVO (satisfaz EnviadorDeDocumento por estrutura; o port
   *  ConversationGateway congelado permanece intocado).
   *  Evolution v2: POST /message/sendMedia/{instance}. */
  async sendDocument(
    chatId: string,
    anexo: { readonly fileName: string; readonly mimeType: string; readonly base64: string },
    caption: string,
  ): Promise<void> {
    await this.http.postJson(this.url('/message/sendMedia'), this.headers(), {
      number: toNumber(chatId),
      mediatype: 'document',
      mimetype: anexo.mimeType,
      media: anexo.base64,
      fileName: anexo.fileName,
      caption,
    });
  }

  async setPresence(chatId: string, state: PresenceState): Promise<void> {
    await this.http.postJson(this.url('/chat/sendPresence'), this.headers(), {
      number: toNumber(chatId),
      presence: toEvolutionPresence(state),
      delay: 0,
    });
  }

  async sendReaction(chatId: string, messageId: string, emoji: string): Promise<void> {
    await this.http.postJson(this.url('/message/sendReaction'), this.headers(), {
      key: { remoteJid: chatId, id: messageId, fromMe: true },
      reaction: emoji,
    });
  }

  async markRead(chatId: string, messageId: string): Promise<void> {
    await this.http.postJson(this.url('/chat/markMessageAsRead'), this.headers(), {
      readMessages: [{ remoteJid: chatId, id: messageId, fromMe: false }],
    });
  }
}
