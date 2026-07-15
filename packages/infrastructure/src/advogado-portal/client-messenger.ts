// ─────────────────────────────────────────────────────────────────────────────
// CLIENT MESSENGER — implementa a porta de entrega da ponte Advogado→AHRI usando
// EXCLUSIVAMENTE as peças públicas de 2B: registra a intenção (com proveniência),
// fraseia pelo LLM de expressão com guard anti-repetição, enfileira e entrega com
// a humanização completa (ler→pensar→digitar→enviar). Nenhuma decisão aqui: a
// intenção JÁ VEM decidida pelo Brain.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ClientMessengerPort,
  ConversationContextRuntime,
  ConversationIntent,
  ConversationMemoryRuntime,
  DeliveryRuntime,
  HumanizationPolicy,
  LlmExpressionPort,
  MessageQueueRuntime,
  PromptBuilderRuntime,
} from '@reconstrua/application';
import { isRepetition } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';

export interface ClientMessengerDeps {
  readonly memory: ConversationMemoryRuntime;
  readonly context: ConversationContextRuntime;
  readonly promptBuilder: PromptBuilderRuntime;
  readonly expression: LlmExpressionPort;
  readonly queue: MessageQueueRuntime;
  readonly delivery: DeliveryRuntime;
  readonly policy: HumanizationPolicy;
  readonly clock: Clock;
}

export class ConversationClientMessenger implements ClientMessengerPort {
  constructor(private readonly deps: ClientMessengerDeps) {}

  async deliver(intent: ConversationIntent): Promise<void> {
    const d = this.deps;
    const now = d.clock.now();
    await d.memory.recordIntent(intent); // proveniência registrada (INV-AH-02)

    const view = await d.context.build(intent.chatId, null, now);

    // Fraseia com anti-repetição (mesma disciplina de 2B).
    let text = '';
    let avoid = [...view.recentOutboundTexts];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const request = { ...d.promptBuilder.build(intent, view), avoidPhrases: avoid };
      text = await d.expression.phrase(request);
      if (!isRepetition(text, view.recentOutboundTexts, d.policy.repetitionThreshold)) break;
      avoid = [...avoid, text];
    }

    await d.queue.enqueue(intent.chatId, intent.id, text);
    await d.delivery.drain(view); // entrega humanizada (nunca instantânea)
  }
}
