// ─────────────────────────────────────────────────────────────────────────────
// SILENCE DETECTION RUNTIME — percebe SILÊNCIO e TIMEOUT do cliente.
//
// DETECÇÃO é mecânica (quanto tempo sem falar?), não decisão. O que FAZER diante
// do silêncio (cobrar? esperar? acompanhar?) é decisão do Executive Brain. Aqui só
// se PRODUZ o Percept de silêncio/timeout que alimentará o Brain — nunca uma ação.
// ─────────────────────────────────────────────────────────────────────────────
import type { InboundEnvelope, PerceptKind } from './percept.js';
import type { HumanizationPolicy } from './humanization-policy.js';
import type { Session } from './ports.js';

export interface SilenceSignal {
  readonly chatId: string;
  readonly kind: Extract<PerceptKind, 'silence' | 'timeout'>;
  readonly silenceMs: number;
  readonly envelope: InboundEnvelope;
}

export class SilenceDetectionRuntime {
  constructor(private readonly policy: HumanizationPolicy) {}

  /** Quanto tempo (ms) a conversa está sem entrada do cliente. */
  private idleMs(session: Session, now: Date): number {
    const reference = session.lastInboundAt ?? session.openedAt;
    return now.getTime() - reference.getTime();
  }

  /**
   * Varre as sessões ativas e produz sinais de silêncio/timeout ainda NÃO
   * percebidos (evita re-perceber o mesmo silêncio a cada tick). Timeout tem
   * precedência sobre silêncio.
   */
  scan(sessions: readonly Session[], now: Date): readonly SilenceSignal[] {
    const signals: SilenceSignal[] = [];
    for (const session of sessions) {
      if (session.status !== 'active') continue;
      const idle = this.idleMs(session, now);

      const alreadyNoticed =
        session.lastSilenceNoticeAt !== null &&
        (session.lastInboundAt === null ||
          session.lastSilenceNoticeAt.getTime() >= session.lastInboundAt.getTime());

      if (idle >= this.policy.timeoutThresholdMs) {
        signals.push(this.signal(session.chatId, 'timeout', idle, now));
      } else if (idle >= this.policy.silenceThresholdMs && !alreadyNoticed) {
        signals.push(this.signal(session.chatId, 'silence', idle, now));
      }
    }
    return signals;
  }

  private signal(
    chatId: string,
    kind: 'silence' | 'timeout',
    silenceMs: number,
    now: Date,
  ): SilenceSignal {
    const envelope: InboundEnvelope = {
      messageId: `${kind}:${chatId}:${String(now.getTime())}`,
      chatId,
      from: chatId,
      kind,
      text: null,
      mediaUrl: null,
      mediaMimeType: null,
      fileName: null,
      location: null,
      contact: null,
      reactionEmoji: null,
      reactionToMessageId: null,
      editedText: null,
      deletedMessageId: null,
      silenceMs,
      timestamp: now,
    };
    return { chatId, kind, silenceMs, envelope };
  }
}
