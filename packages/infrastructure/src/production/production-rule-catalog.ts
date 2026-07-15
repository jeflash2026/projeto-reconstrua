// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION RULE CATALOG — correção A3 da homologação 4B.
//
// CAUSA: o catálogo 2D não tinha NENHUMA Regra Operacional falante para os
// percepts temporais (`silence`/`timeout`) ⇒ o Scheduler disparava, o Brain
// (corretamente, pelo catálogo) decidia WAIT, e o cliente jamais recebia retorno.
//
// CORREÇÃO: catálogo de PRODUÇÃO = catálogo 2D (intocado, importado) + as ROs de
// reengajamento. NUNCA timer cego: o timer só PERCEBE; quem decide falar continua
// sendo o Executive Brain, por regra, com fundamento e bloqueios (matéria humana
// bloqueia; missão encerrada bloqueia). A Conversation continua só executora.
// ─────────────────────────────────────────────────────────────────────────────
import type { OperationalRuleSpec } from '@reconstrua/application';
import { MISSION_RULE_CATALOG } from '../mission-runtime/mission-rule-catalog.js';

export const FOLLOW_UP_RULES: readonly OperationalRuleSpec[] = [
  {
    ref: 'RO-4C-FOLLOWUP-SILENCE',
    title: 'Retomar contato quando o cliente silencia (workflow exige retorno)',
    priority: 55,
    preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'silence' }],
    blocks: [
      { fact: 'matterRequiresHuman', op: 'truthy' },
      { fact: 'stateCode', op: 'eq', value: 'ENCERRADA' },
    ],
    action: {
      kind: 'conversation',
      directive: 'insist',
      speechAct: 'follow_up',
      topic: 'retomar nosso último assunto',
      references: ['reengajamento'],
      urgency: 'normal',
    },
    fundamento: 'Art. 9º (INV-07: sempre há próxima ação) + RO-R8-004 (reengajamento respeitoso); RO-R7-001',
  },
  {
    ref: 'RO-4C-FOLLOWUP-TIMEOUT',
    title: 'Acompanhamento agendado vencido → falar com o cliente',
    priority: 55,
    preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'timeout' }],
    blocks: [
      { fact: 'matterRequiresHuman', op: 'truthy' },
      { fact: 'stateCode', op: 'eq', value: 'ENCERRADA' },
    ],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'follow_up',
      topic: 'o andamento do seu caso',
      references: ['acompanhamento-agendado'],
      urgency: 'normal',
    },
    fundamento: 'Art. 9º (INV-07) + RO-R6-002 (acompanhamento) — a AHRI jamais abandona um cliente; RO-R7-001',
  },
];

/** Catálogo de PRODUÇÃO: 2D congelado + reengajamento 4C. */
export const PRODUCTION_RULE_CATALOG: readonly OperationalRuleSpec[] = [
  ...MISSION_RULE_CATALOG,
  ...FOLLOW_UP_RULES,
];
