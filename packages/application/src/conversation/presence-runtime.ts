// ─────────────────────────────────────────────────────────────────────────────
// PRESENCE RUNTIME — governa a PRESENÇA da AHRI no WhatsApp (available/composing/
// recording/paused/unavailable). Presença é sinal humano: "está online", "está
// digitando", "parou". Reflete o estado na sessão e no gateway. Não decide nada.
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationGateway, PresenceState } from './ports.js';
import type { SessionRuntime } from './session-runtime.js';

export class PresenceRuntime {
  constructor(
    private readonly gateway: ConversationGateway,
    private readonly sessions: SessionRuntime,
  ) {}

  async set(chatId: string, state: PresenceState, now: Date): Promise<void> {
    await this.gateway.setPresence(chatId, state);
    await this.sessions.setPresence(chatId, state, now);
  }

  async available(chatId: string, now: Date): Promise<void> {
    await this.set(chatId, 'available', now);
  }

  async paused(chatId: string, now: Date): Promise<void> {
    await this.set(chatId, 'paused', now);
  }
}
