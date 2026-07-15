// ─────────────────────────────────────────────────────────────────────────────
// assembleConversationRuntime — raiz de composição do Runtime de Conversa. Fia os
// DOZE runtimes (session, memory, context, prompt, timing, delay, presence,
// typing, queue, silence, delivery, conversation) sobre os adapters injetados.
// Um único lugar de montagem — usado por testes e pela API.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import {
  ConversationContextRuntime,
  ConversationMemoryRuntime,
  ConversationRuntime,
  DelayRuntime,
  DeliveryRuntime,
  DEFAULT_HUMANIZATION_POLICY,
  HumanLikeTimingRuntime,
  MessageQueueRuntime,
  PresenceRuntime,
  PromptBuilderRuntime,
  SessionRuntime,
  SilenceDetectionRuntime,
  TypingRuntime,
} from '@reconstrua/application';
import type {
  ConversationGateway,
  ConversationStore,
  ExecutiveBrainPort,
  HumanizationPolicy,
  LlmExpressionPort,
  LlmPerceptionPort,
  MessageQueueStore,
  Rng,
  SessionStore,
  Sleeper,
} from '@reconstrua/application';

export interface ConversationWiring {
  readonly gateway: ConversationGateway;
  readonly perception: LlmPerceptionPort;
  readonly expression: LlmExpressionPort;
  readonly brain: ExecutiveBrainPort;
  readonly conversationStore: ConversationStore;
  readonly sessionStore: SessionStore;
  readonly queueStore: MessageQueueStore;
  readonly sleeper: Sleeper;
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly policy?: HumanizationPolicy;
  readonly rng?: Rng;
}

export function assembleConversationRuntime(wiring: ConversationWiring): ConversationRuntime {
  const policy = wiring.policy ?? DEFAULT_HUMANIZATION_POLICY;
  const rng: Rng = wiring.rng ?? Math.random;

  const sessions = new SessionRuntime(wiring.sessionStore);
  const memory = new ConversationMemoryRuntime(wiring.conversationStore, wiring.clock, wiring.uuid);
  const context = new ConversationContextRuntime(sessions, memory);
  const promptBuilder = new PromptBuilderRuntime(policy.antiRepetitionWindow);
  const timing = new HumanLikeTimingRuntime(policy, rng);
  const delay = new DelayRuntime(wiring.sleeper);
  const presence = new PresenceRuntime(wiring.gateway, sessions);
  const typing = new TypingRuntime(presence, delay);
  const queue = new MessageQueueRuntime(wiring.queueStore, wiring.clock, wiring.uuid);
  const delivery = new DeliveryRuntime({
    gateway: wiring.gateway,
    timing,
    typing,
    delay,
    presence,
    queue,
    sessions,
    memory,
    clock: wiring.clock,
    policy,
  });
  const silence = new SilenceDetectionRuntime(policy);

  return new ConversationRuntime({
    perception: wiring.perception,
    expression: wiring.expression,
    brain: wiring.brain,
    gateway: wiring.gateway,
    sessions,
    memory,
    context,
    promptBuilder,
    queue,
    delivery,
    silence,
    clock: wiring.clock,
    uuid: wiring.uuid,
    policy,
  });
}
