// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONAL RULE SPEC — a forma EXECUTÁVEL de uma Regra Operacional no catálogo
// do Brain (a projeção que o RuleCatalogPort serve; ADR-0002A §6). NÃO é o agregado
// de domínio `OperationalRuleAggregate` (governança/aprovação, congelado) — é a
// regra já aprovada, em forma avaliável pelo motor determinístico.
//
// Cada regra possui (spec 2C): PRIORIDADE, PRÉ-CONDIÇÕES, BLOQUEIOS, AÇÃO, FUNDAMENTO.
// A AÇÃO é uma união discriminada — uma das seis naturezas de intenção do Brain.
// ─────────────────────────────────────────────────────────────────────────────
import type { IntentDirective, IntentUrgency, SpeechAct } from '../conversation/intent.js';
import type { Condition } from './conditions.js';
import type { HumanRole } from './mission-snapshot.js';

export type RuleActionKind = 'conversation' | 'use_case' | 'escalation' | 'wait' | 'stop' | 'notification';

/** A AÇÃO de uma regra — descreve QUE intenção emitir (nunca texto; nunca LLM). */
export type RuleAction =
  | {
      readonly kind: 'conversation';
      readonly directive: IntentDirective;
      readonly speechAct: SpeechAct | null;
      readonly topic: string | null;
      readonly references: readonly string[];
      readonly urgency: IntentUrgency;
    }
  | { readonly kind: 'use_case'; readonly useCase: string; readonly references: readonly string[] }
  | { readonly kind: 'escalation'; readonly role: HumanRole; readonly reasonCode: string }
  | { readonly kind: 'wait'; readonly reasonCode: string; readonly untilHintMs: number | null }
  | { readonly kind: 'stop'; readonly reasonCode: string }
  | { readonly kind: 'notification'; readonly channel: string; readonly audience: string; readonly reasonCode: string };

export interface OperationalRuleSpec {
  /** REGRA OPERACIONAL — referência única e citável (ex.: 'RO-2C-COLETA-001'). */
  readonly ref: string;
  readonly title: string;
  /** PRIORIDADE — maior vence no ordenamento. */
  readonly priority: number;
  /** PRÉ-CONDIÇÕES — TODAS devem ser verdadeiras para a regra ser candidata. */
  readonly preconditions: readonly Condition[];
  /** BLOQUEIOS — se QUALQUER um for verdadeiro, a regra é bloqueada. */
  readonly blocks: readonly Condition[];
  /** AÇÃO a executar quando aplicável. */
  readonly action: RuleAction;
  /** FUNDAMENTO — base constitucional + operacional citável. */
  readonly fundamento: string;
}
