// ─────────────────────────────────────────────────────────────────────────────
// TYPING RUNTIME — encena a DIGITAÇÃO: liga "composing" (ou "recording" p/ áudio),
// espera a duração de digitação humana, e devolve. É o gesto visível de que a AHRI
// está escrevendo — nunca uma resposta que "aparece do nada". Não decide conteúdo.
// ─────────────────────────────────────────────────────────────────────────────
import type { PresenceRuntime } from './presence-runtime.js';
import type { DelayRuntime } from './delay-runtime.js';

export class TypingRuntime {
  constructor(
    private readonly presence: PresenceRuntime,
    private readonly delay: DelayRuntime,
  ) {}

  /** Mostra "digitando" por `durationMs` e então pausa a digitação. */
  async typeFor(chatId: string, durationMs: number, now: Date): Promise<void> {
    await this.presence.set(chatId, 'composing', now);
    await this.delay.wait(durationMs);
    await this.presence.set(chatId, 'paused', now);
  }
}
