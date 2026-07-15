// ─────────────────────────────────────────────────────────────────────────────
// SESSION RUNTIME — o ciclo de vida da conversa por contato (chatId).
//
// A sessão é CONTEXTO de runtime (turnos, presença, última entrada/saída), não
// Verdade de domínio. Não decide nada: apenas registra o estado técnico da
// conversa que a humanização e o Brain consultam. Nunca muta domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type { PresenceState, Session, SessionStore } from './ports.js';

export class SessionRuntime {
  constructor(private readonly store: SessionStore) {}

  async getOrOpen(chatId: string, now: Date): Promise<Session> {
    return this.store.getOrOpen(chatId, now);
  }

  /** Registra chegada de entrada do cliente: atualiza lastInbound e conta turno. */
  async touchInbound(chatId: string, now: Date): Promise<Session> {
    const current = await this.store.getOrOpen(chatId, now);
    const next: Session = {
      ...current,
      lastInboundAt: now,
      turns: current.turns + 1,
      status: current.status === 'closed' ? 'active' : current.status,
    };
    await this.store.save(next);
    return next;
  }

  /** Registra envio da AHRI. */
  async touchOutbound(chatId: string, now: Date): Promise<Session> {
    const current = await this.store.getOrOpen(chatId, now);
    const next: Session = { ...current, lastOutboundAt: now };
    await this.store.save(next);
    return next;
  }

  async setPresence(chatId: string, presence: PresenceState, now: Date): Promise<Session> {
    const current = await this.store.getOrOpen(chatId, now);
    const next: Session = { ...current, presence };
    await this.store.save(next);
    return next;
  }

  async setAwaitingDocuments(chatId: string, awaiting: boolean, now: Date): Promise<Session> {
    const current = await this.store.getOrOpen(chatId, now);
    const next: Session = { ...current, awaitingDocuments: awaiting };
    await this.store.save(next);
    return next;
  }

  async setStatus(chatId: string, status: Session['status'], now: Date): Promise<Session> {
    const current = await this.store.getOrOpen(chatId, now);
    const next: Session = { ...current, status };
    await this.store.save(next);
    return next;
  }

  async markSilenceNoticed(chatId: string, now: Date): Promise<Session> {
    const current = await this.store.getOrOpen(chatId, now);
    const next: Session = { ...current, lastSilenceNoticeAt: now };
    await this.store.save(next);
    return next;
  }

  async all(): Promise<readonly Session[]> {
    return this.store.all();
  }
}
