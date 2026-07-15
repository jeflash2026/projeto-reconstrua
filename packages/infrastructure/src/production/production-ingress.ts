// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION INGRESS — correção A2 da homologação 4B.
//
// CAUSA: o webhook processava turnos do MESMO cliente em paralelo; o mapa de
// identidades é read-modify-write ⇒ duas mensagens simultâneas de um cliente NOVO
// criavam DUAS missões.
//
// CORREÇÃO: TODO turno (mensagem do WhatsApp E sinal temporal) entra por uma FILA
// POR chatId — cadeia de promessas por conversa (o padrão do SerializedSubscriber
// 2F). Turnos de conversas diferentes seguem paralelos; turnos da MESMA conversa
// são estritamente sequenciais ⇒ o segundo turno SEMPRE enxerga a identidade
// gravada pelo primeiro ⇒ 1 cliente → 1 missão, sob qualquer concorrência, rajada,
// retry ou redelivery (redelivery idêntica já era coberta pela idempotência de
// messageId, que continua valendo DENTRO da fila).
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationRuntime, InboundEnvelope, SchedulerRuntime, TurnResult, ScheduledTask } from '@reconstrua/application';

function toTemporalEnvelope(task: ScheduledTask, now: Date): InboundEnvelope {
  return {
    messageId: `sched:${task.id}`,
    chatId: task.chatId,
    from: task.chatId,
    kind: 'timeout',
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
    silenceMs: Math.max(0, now.getTime() - task.createdAt.getTime()),
    timestamp: now,
  };
}

export class ProductionIngress {
  private readonly chains = new Map<string, Promise<unknown>>();

  constructor(
    private readonly conversation: ConversationRuntime,
    private readonly scheduler: SchedulerRuntime,
    /** Resolve o chatId REAL de uma missão (defeito achado pelo Shadow 4D: tarefas
     *  do workflow carregam missionId como chatId quando o evento não tem chatId —
     *  sem resolver, o follow-up iria para um "número" inválido em produção). */
    private readonly chatOfMission: (missionId: string) => string | null = () => null,
  ) {}

  /** Enfileira uma operação na cadeia da conversa (estritamente sequencial por chat). */
  private enqueue<T>(chatId: string, op: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(chatId) ?? Promise.resolve();
    const next = previous.then(op, op); // a cadeia nunca quebra; o erro vai ao chamador
    this.chains.set(chatId, next.catch(() => undefined));
    return next;
  }

  /** ENTRADA ÚNICA de mensagens do cliente (webhook) — serializada por conversa. */
  receive(envelope: InboundEnvelope): Promise<TurnResult> {
    return this.enqueue(envelope.chatId, () => this.conversation.receive(envelope));
  }

  /** ENTRADA ÚNICA de sinais temporais — mesma fila da conversa (sem corrida com inbound). */
  async tick(now: Date): Promise<readonly TurnResult[]> {
    const fired = await this.scheduler.fireDue(now);
    const results: TurnResult[] = [];
    for (const task of fired) {
      // Correção 4D: se o chatId da tarefa não é um JID de WhatsApp (fallback de
      // missionId do workflow), resolve o chat REAL da missão; sem resolução,
      // NÃO fala com um destinatário inválido (registra e segue).
      let chatId = task.chatId;
      if (!chatId.includes('@')) {
        const resolved = this.chatOfMission(task.missionId ?? chatId);
        if (resolved === null) continue; // destinatário irresolúvel: nunca enviar para número inválido
        chatId = resolved;
      }
      const routed = { ...task, chatId };
      results.push(
        await this.enqueue(chatId, () =>
          this.conversation.onTemporalTrigger(toTemporalEnvelope(routed, now), now),
        ),
      );
    }
    return results;
  }
}
