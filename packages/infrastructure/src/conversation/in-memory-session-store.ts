// ─────────────────────────────────────────────────────────────────────────────
// InMemorySessionStore — estado técnico da conversa por chatId (contexto de
// runtime, não domínio). Abre a sessão na primeira interação e a mantém.
// ─────────────────────────────────────────────────────────────────────────────
import type { Session, SessionStore } from '@reconstrua/application';

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  getOrOpen(chatId: string, now: Date): Promise<Session> {
    const existing = this.sessions.get(chatId);
    if (existing) return Promise.resolve(existing);
    const opened: Session = {
      chatId,
      openedAt: now,
      lastInboundAt: null,
      lastOutboundAt: null,
      turns: 0,
      presence: 'available',
      awaitingDocuments: false,
      status: 'active',
      lastSilenceNoticeAt: null,
    };
    this.sessions.set(chatId, opened);
    return Promise.resolve(opened);
  }

  save(session: Session): Promise<void> {
    this.sessions.set(session.chatId, session);
    return Promise.resolve();
  }

  all(): Promise<readonly Session[]> {
    return Promise.resolve([...this.sessions.values()]);
  }
}
