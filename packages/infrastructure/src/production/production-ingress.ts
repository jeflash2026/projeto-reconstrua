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
import type {
  ConversationRuntime,
  FollowUpRecurrenceRuntime,
  InboundEnvelope,
  SchedulerRuntime,
  TurnResult,
  ScheduledTask,
} from '@reconstrua/application';
import type { MedidorDeCusto } from '../custos/medidor-de-custo.js';

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
    /** B4.2: recorrência CONTROLADA — reagenda o próximo acompanhamento quando este
     *  disparo produziu acompanhamento ao cliente (RO-4C-*). Opcional (ausente = one-shot). */
    private readonly recurrence?: FollowUpRecurrenceRuntime,
    /** 15C-4: autonomia do DocumentRequest — resolve confirmação pendente ANTES do
     *  turno (mesma fila, sem corrida) e roda a varredura de SLA no tick.
     *  Best-effort: jamais derruba conversa ou tick. Opcional. */
    private readonly autonomia?: {
      aoReceberTexto(chatId: string, texto: string, now: Date): Promise<void>;
      varredura(now: Date): Promise<void>;
      /** 15ª rodada: documento novo chegando ⇒ progressão pendente do envio
       *  anterior é SUPERADA (evita anúncio duplicado do mesmo registro). */
      aoReceberDocumento?(chatId: string, now: Date): Promise<void>;
    },
    /** Medidor de Custo (2026-07-21): todo turno roda com o chatId em contexto —
     *  cada chamada de IA do turno é atribuída ao cliente. Opcional (não mede). */
    private readonly custo?: MedidorDeCusto,
  ) {}

  /** Enfileira uma operação na cadeia da conversa (estritamente sequencial por chat). */
  private enqueue<T>(chatId: string, op: () => Promise<T>): Promise<T> {
    const medido = this.custo ? (): Promise<T> => this.custo!.noTurno(chatId, op) : op;
    const previous = this.chains.get(chatId) ?? Promise.resolve();
    const next = previous.then(medido, medido); // a cadeia nunca quebra; o erro vai ao chamador
    this.chains.set(
      chatId,
      next.catch(() => undefined),
    );
    return next;
  }

  /** ENTRADA ÚNICA de mensagens do cliente (webhook) — serializada por conversa. */
  receive(envelope: InboundEnvelope): Promise<TurnResult> {
    return this.enqueue(envelope.chatId, async () => {
      // 15C-4 · Parte 1: resposta de texto pode RESOLVER uma confirmação pendente
      // — roda ANTES do turno (o snapshot já chega limpo à conversa). Best-effort.
      if (
        this.autonomia &&
        envelope.kind === 'text' &&
        envelope.text !== null &&
        envelope.text !== ''
      ) {
        await this.autonomia
          .aoReceberTexto(envelope.chatId, envelope.text, envelope.timestamp)
          .catch(() => undefined);
      }
      if (
        this.autonomia?.aoReceberDocumento &&
        (envelope.kind === 'image' || envelope.kind === 'pdf' || envelope.kind === 'document')
      ) {
        await this.autonomia
          .aoReceberDocumento(envelope.chatId, envelope.timestamp)
          .catch(() => undefined);
      }
      return this.conversation.receive(envelope);
    });
  }

  /** ENTRADA ÚNICA de sinais temporais — mesma fila da conversa (sem corrida com inbound). */
  async tick(now: Date): Promise<readonly TurnResult[]> {
    const results: TurnResult[] = [];
    // BUG RAIZ (caso Rosana, 2026-07-22): a varredura (retomada + SLA) rodava
    // DEPOIS do processamento dos agendamentos. Uma única falha ali (fireDue ou
    // um follow-up) abortava o tick ANTES da varredura ⇒ a retomada NUNCA rodava
    // para NINGUÉM. Agora o bloco de agendamentos é ISOLADO (cada tarefa e o
    // fireDue em try/catch) e a varredura roda SEMPRE, aconteça o que acontecer.
    try {
      const fired = await this.scheduler.fireDue(now);
      for (const task of fired) {
        try {
          // Correção 4D: se o chatId da tarefa não é um JID de WhatsApp (fallback
          // de missionId do workflow), resolve o chat REAL da missão; sem
          // resolução, NÃO fala com um destinatário inválido (registra e segue).
          let chatId = task.chatId;
          if (!chatId.includes('@')) {
            const resolved = this.chatOfMission(task.missionId ?? chatId);
            if (resolved === null) continue; // irresolúvel: nunca enviar a número inválido
            chatId = resolved;
          }
          const routed = { ...task, chatId };
          const result = await this.enqueue(chatId, () =>
            this.conversation.onTemporalTrigger(toTemporalEnvelope(routed, now), now),
          );
          results.push(result);
          // B4.2: se ESTE acompanhamento falou ao cliente (RO-4C-*), agenda o
          // próximo (bounded, cadência mínima). Encerrado/escalação/espera não recorrem.
          if (this.recurrence) await this.recurrence.onFollowUpFired(routed, result, now);
        } catch {
          // Uma tarefa problemática NUNCA bloqueia as demais nem a varredura.
        }
      }
    } catch {
      // fireDue falhou — a varredura (retomada/SLA) AINDA precisa rodar.
    }
    // Varredura (retomada de conversas caídas + SLA dos DocumentRequests) —
    // roda SEMPRE, isolada de tudo acima. Best-effort: nunca derruba o tick.
    if (this.autonomia) await this.autonomia.varredura(now).catch(() => undefined);
    return results;
  }
}
