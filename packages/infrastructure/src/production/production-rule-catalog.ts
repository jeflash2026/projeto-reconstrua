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
import { DEFAULT_RULE_CATALOG } from '../executive-brain/default-rule-catalog.js';

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
  // GO-LIVE 9B: o follow-up que fala do CASO exige o FATO caseExists (Truth Layer);
  // sem caso, o timeout reengaja como RELAÇÃO — nunca afirmando caso inexistente.
  {
    ref: 'RO-4C-FOLLOWUP-TIMEOUT',
    title: 'Acompanhamento agendado vencido → falar do CASO (fato de domínio presente)',
    priority: 55,
    preconditions: [
      { fact: 'perceptKind', op: 'eq', value: 'timeout' },
      { fact: 'caseExists', op: 'truthy' },
    ],
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
    fundamento: 'Art. 9º (INV-07) + RO-R6-002 (acompanhamento) — a AHRI jamais abandona um cliente; RO-R7-001; GO-LIVE 9B',
  },
  {
    ref: 'RO-4C-FOLLOWUP-TIMEOUT-RELATE',
    title: 'Acompanhamento agendado vencido SEM caso → retomar a conversa',
    priority: 55,
    preconditions: [
      { fact: 'perceptKind', op: 'eq', value: 'timeout' },
      { fact: 'caseExists', op: 'falsy' },
    ],
    blocks: [
      { fact: 'matterRequiresHuman', op: 'truthy' },
      { fact: 'stateCode', op: 'eq', value: 'ENCERRADA' },
    ],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'follow_up',
      topic: 'retomar nossa conversa',
      references: ['reengajamento'],
      urgency: 'normal',
    },
    fundamento: 'Art. 9º (INV-07) + RO-R8-004 (reengajamento respeitoso); GO-LIVE 9B (relação ≠ caso)',
  },
];

// CAT-01 — regras APROVADAS reconectadas ao catálogo oficial por REUSO do
// DEFAULT_RULE_CATALOG (specs intocadas, sem reescrever). Somente comportamentos
// dignos de produção e HOJE ausentes, com pré-condição estreita (sem conflito de
// prioridade nem duplicação de refs já ativas em 2D/4C):
//   • RO-DEADLINE-WARN-001        prazo ≤3 dias → avisa o cliente (proativo)
//   • RO-META-ESCALATE-CANON-001  Canon silente → escala supervisor (E10/DF-13; fail-safe)
//   • RO-STOP-CONCLUDED-001       missão ENCERRADA → PARA (B4.1; terminalidade oficial)
// B4.1 — ativa o encerramento: quando o Estado é terminal (ENCERRADA), o Brain PARA
// (prioridade 90) e todo acompanhamento recorrente futuro fica bloqueado. Reutiliza a
// regra CONGELADA do DEFAULT_RULE_CATALOG, sem reescrevê-la.
// Regras que dependem de mídia (RECOGNIZE/INGEST já em 2D), de destino não publicado
// (NOTIFY-HUMAN) ou de ajuste de UX (EXPLAIN, DOC-REQUEST) permanecem para sprints próprios.
const APPROVED_ADDITIONS: readonly string[] = ['RO-DEADLINE-WARN-001', 'RO-META-ESCALATE-CANON-001', 'RO-STOP-CONCLUDED-001'];
const APPROVED_FROM_DEFAULT: readonly OperationalRuleSpec[] = DEFAULT_RULE_CATALOG.filter((r) =>
  APPROVED_ADDITIONS.includes(r.ref),
);

/** Catálogo de PRODUÇÃO: 2D congelado + reengajamento 4C + regras aprovadas (CAT-01). */
export const PRODUCTION_RULE_CATALOG: readonly OperationalRuleSpec[] = [
  ...MISSION_RULE_CATALOG,
  ...FOLLOW_UP_RULES,
  ...APPROVED_FROM_DEFAULT,
];
