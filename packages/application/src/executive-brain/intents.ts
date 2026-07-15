// ─────────────────────────────────────────────────────────────────────────────
// BRAIN INTENTS — as SEIS (e apenas seis) naturezas de saída do Brain:
// Conversation, UseCase, Escalation, Wait, Stop, Notification.
//
// Nenhuma delas contém TEXTO gerado: o Brain decide, não escreve. A ConversationIntent
// carrega diretiva/ato-de-fala/tópico/refs (a Conversa frasea). A UseCaseIntent
// nomeia um caso de uso e parâmetros (o domínio muta alhures, por fábrica congelada).
// Toda intenção carrega PROVENIÊNCIA (DECISOR/TIPO/FUNDAMENTO/REGRA).
// ─────────────────────────────────────────────────────────────────────────────
import type { IntentDirective, IntentUrgency, SpeechAct } from '../conversation/intent.js';
import type { HumanRole } from './mission-snapshot.js';
import type { DecisionProvenance } from './provenance.js';

export type BrainIntentKind = 'conversation' | 'use_case' | 'escalation' | 'wait' | 'stop' | 'notification';

interface IntentBase {
  readonly id: string;
  readonly missionId: string;
  readonly chatId: string | null;
  readonly provenance: DecisionProvenance;
  readonly formedAt: Date;
}

export interface ConversationIntentOut extends IntentBase {
  readonly kind: 'conversation';
  readonly directive: IntentDirective;
  readonly speechAct: SpeechAct | null;
  readonly topic: string | null;
  readonly references: readonly string[];
  readonly urgency: IntentUrgency;
}

export interface UseCaseIntentOut extends IntentBase {
  readonly kind: 'use_case';
  readonly useCase: string;
  readonly references: readonly string[];
}

export interface EscalationIntentOut extends IntentBase {
  readonly kind: 'escalation';
  readonly role: HumanRole;
  readonly reasonCode: string;
}

export interface WaitIntentOut extends IntentBase {
  readonly kind: 'wait';
  readonly reasonCode: string;
  readonly untilHintMs: number | null;
}

export interface StopIntentOut extends IntentBase {
  readonly kind: 'stop';
  readonly reasonCode: string;
}

export interface NotificationIntentOut extends IntentBase {
  readonly kind: 'notification';
  readonly channel: string;
  readonly audience: string;
  readonly reasonCode: string;
}

export type BrainIntent =
  | ConversationIntentOut
  | UseCaseIntentOut
  | EscalationIntentOut
  | WaitIntentOut
  | StopIntentOut
  | NotificationIntentOut;
