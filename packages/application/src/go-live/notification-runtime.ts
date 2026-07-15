// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION RUNTIME — o consumidor das intenções `notification` do Executive
// Brain (2C). A AHRI só notifica QUANDO O BRAIN DECIDIU (proveniência obrigatória).
// ANTI-SPAM: intervalo mínimo por (audiência × motivo) — nunca mecânico, nunca
// enxurrada. Mensagens ao CLIENTE não passam por aqui (são intenções de conversa,
// entregues pela humanização de 2B); aqui é o canal para HUMANOS/portais.
// ─────────────────────────────────────────────────────────────────────────────
import type { NotificationIntentOut } from '../executive-brain/index.js';

export interface DeliveredNotification {
  readonly channel: string;
  readonly audience: string;
  readonly reasonCode: string;
  readonly missionId: string;
  readonly operationalRuleRef: string;
  readonly at: Date;
}

export interface NotificationChannelPort {
  deliver(notification: DeliveredNotification): Promise<void>;
}

export interface NotificationPolicy {
  /** Intervalo mínimo entre notificações iguais (audiência×motivo), em ms. */
  readonly minIntervalMs: number;
}

export const DEFAULT_NOTIFICATION_POLICY: NotificationPolicy = {
  minIntervalMs: 60 * 60_000, // 1h — parâmetro operacional
};

export class NotificationRuntime {
  private readonly lastSent = new Map<string, number>();
  private suppressedCount = 0;

  constructor(
    private readonly channel: NotificationChannelPort,
    private readonly policy: NotificationPolicy = DEFAULT_NOTIFICATION_POLICY,
  ) {}

  /** Consome uma intenção de notificação do Brain. Devolve true se entregue. */
  async consume(intent: NotificationIntentOut, now: Date): Promise<boolean> {
    const key = `${intent.audience}|${intent.reasonCode}`;
    const last = this.lastSent.get(key);
    if (last !== undefined && now.getTime() - last < this.policy.minIntervalMs) {
      this.suppressedCount += 1; // anti-spam: suprime a repetição mecânica
      return false;
    }
    await this.channel.deliver({
      channel: intent.channel,
      audience: intent.audience,
      reasonCode: intent.reasonCode,
      missionId: intent.missionId,
      operationalRuleRef: intent.provenance.operationalRuleRef,
      at: now,
    });
    this.lastSent.set(key, now.getTime());
    return true;
  }

  suppressed(): number {
    return this.suppressedCount;
  }
}
