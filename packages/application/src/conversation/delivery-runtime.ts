// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY RUNTIME — a ENTREGA humana. Consome a fila (FIFO por conversa) e, para
// cada mensagem, encena o gesto humano completo:
//
//   ler (delay) → pensar (delay) → DIGITANDO (composing + delay) → enviar → pausar
//
// GARANTIAS (spec 2B):
//  • Nunca instantâneo: sempre há atraso pré-envio > 0 (minPreSendMs).
//  • Nunca sobreposto: uma mensagem por vez, em ordem; pausa entre mensagens.
//  • Registra a saída na memória e atualiza a sessão. Não decide conteúdo.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { ConversationContextView, ConversationGateway, QueuedMessage } from './ports.js';
import type { HumanizationPolicy } from './humanization-policy.js';
import type { HumanLikeTimingRuntime, DeliveryTiming } from './human-like-timing-runtime.js';
import type { TypingRuntime } from './typing-runtime.js';
import type { DelayRuntime } from './delay-runtime.js';
import type { PresenceRuntime } from './presence-runtime.js';
import type { MessageQueueRuntime } from './message-queue-runtime.js';
import type { SessionRuntime } from './session-runtime.js';
import type { ConversationMemoryRuntime } from './conversation-memory-runtime.js';

export interface DeliveredMessage {
  readonly providerMessageId: string;
  readonly text: string;
  readonly timing: DeliveryTiming;
}

export interface DeliveryRuntimeDeps {
  readonly gateway: ConversationGateway;
  readonly timing: HumanLikeTimingRuntime;
  readonly typing: TypingRuntime;
  readonly delay: DelayRuntime;
  readonly presence: PresenceRuntime;
  readonly queue: MessageQueueRuntime;
  readonly sessions: SessionRuntime;
  readonly memory: ConversationMemoryRuntime;
  readonly clock: Clock;
  readonly policy: HumanizationPolicy;
}

export class DeliveryRuntime {
  /** Conversas com um drain EM ANDAMENTO — impede que dois laços de entrega
   *  (ex.: o turno e um disparo temporal) processem a MESMA fila em paralelo e
   *  reclamem a mesma pendência (raiz da mensagem enviada 2×). */
  private readonly drenando = new Set<string>();

  constructor(private readonly deps: DeliveryRuntimeDeps) {}

  /** Entrega UMA mensagem com cadência humana completa. */
  async deliverOne(
    msg: QueuedMessage,
    context: ConversationContextView,
  ): Promise<DeliveredMessage> {
    const { timing, delay, typing, gateway, sessions, memory, queue, clock } = this.deps;

    // ANTI-REPETIÇÃO (caso Isaú, 2026-07-23): a MESMA mensagem saía 2× quando a
    // fila era RE-DRENADA — envio ok mas `markSent` não confirmava, ou o pump de
    // 10s e o drain do turno corriam juntos e reclamavam a mesma pendência. Se
    // este texto JÁ saiu há pouco para este chat, NÃO reenvia ao cliente: só
    // limpa a fila. Nunca repete uma mensagem idêntica em sequência.
    const recentes = await memory
      .recentOutboundTexts(msg.chatId, 3)
      .catch(() => [] as readonly string[]);
    if (recentes.includes(msg.text)) {
      await queue.markSent(msg.id).catch(() => undefined);
      return {
        providerMessageId: 'ja-enviado',
        text: msg.text,
        timing: timing.compute(0, msg.text.length),
      };
    }

    const inboundLength = context.lastPercept?.envelope.text?.length ?? 0;
    const plan = timing.compute(inboundLength, msg.text.length);

    // 1) Lê e pensa (com a AHRI ainda sem "digitando").
    await delay.wait(plan.readingDelayMs + plan.thinkingDelayMs);
    // 2) Digita visivelmente pela duração calculada.
    await typing.typeFor(msg.chatId, plan.typingDurationMs, clock.now());
    // 3) Envia.
    const receipt = await gateway.sendText(msg.chatId, msg.text);
    // 4) Registra e atualiza estado.
    await memory.recordOutbound(msg.chatId, msg.text, receipt.providerMessageId);
    await sessions.touchOutbound(msg.chatId, clock.now());
    await queue.markSent(msg.id);

    return { providerMessageId: receipt.providerMessageId, text: msg.text, timing: plan };
  }

  /**
   * Drena TODA a fila pendente da conversa, em ordem, com pausa humana entre
   * mensagens. Devolve o que foi entregue. Nunca envia duas ao mesmo tempo.
   */
  async drain(context: ConversationContextView): Promise<readonly DeliveredMessage[]> {
    const { queue, delay, presence, clock, policy } = this.deps;
    // UM drain por conversa de cada vez: se já há um laço drenando este chat, não
    // concorre — o laço em andamento entrega todas as pendências (inclusive as que
    // acabaram de entrar). Sem isso, dois laços pegam a mesma pendência e enviam 2×.
    if (this.drenando.has(context.chatId)) return [];
    this.drenando.add(context.chatId);
    const delivered: DeliveredMessage[] = [];
    try {
      let first = true;
      for (;;) {
        const next = await queue.nextPending(context.chatId);
        if (!next) break;
        if (!first) {
          await delay.wait(policy.interMessageMs);
        }
        first = false;
        delivered.push(await this.deliverOne(next, context));
      }
    } finally {
      this.drenando.delete(context.chatId);
    }

    if (delivered.length > 0) {
      await presence.paused(context.chatId, clock.now());
    }
    return delivered;
  }
}
