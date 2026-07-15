// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT RULE CATALOG — o catálogo de Regras Operacionais EXECUTÁVEIS do Brain.
// Cada regra tem PRIORIDADE, PRÉ-CONDIÇÕES, BLOQUEIOS, AÇÃO e FUNDAMENTO. Inclui as
// regras-meta obrigatórias (escalação humana, silêncio do Canon, espera default) —
// sem elas o Brain falha fechado (nenhuma decisão sem regra).
//
// Estes são PARÂMETROS OPERACIONAIS (Read Model de ROs; ADR-0002A §6/§8): derivam
// do Canon citado no `fundamento`, não o alteram. Substituíveis por catálogo real.
// ─────────────────────────────────────────────────────────────────────────────
import type { OperationalRuleSpec } from '@reconstrua/application';

export const DEFAULT_RULE_CATALOG: readonly OperationalRuleSpec[] = [
  // ── Regras-meta (fronteira) ────────────────────────────────────────────────
  {
    ref: 'RO-META-ESCALATE-HUMAN-001',
    title: 'Escalar matéria de competência humana',
    priority: 100,
    preconditions: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    blocks: [],
    action: { kind: 'escalation', role: 'advogado', reasonCode: 'COMPETENCIA_HUMANA' },
    fundamento: 'DF-09; INV-AD-01/02 — competência jurídica é humana; RO-R7-001',
  },
  {
    ref: 'RO-META-ESCALATE-CANON-001',
    title: 'Escalar quando o Canon é silente',
    priority: 95,
    preconditions: [{ fact: 'canonSilent', op: 'truthy' }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: { kind: 'escalation', role: 'supervisor', reasonCode: 'CANON_SILENTE' },
    fundamento: 'E10; DF-13 — silêncio do Canon: declarar incerteza e escalar; RO-R7-001',
  },
  {
    ref: 'RO-META-WAIT-DEFAULT-001',
    title: 'Esperar quando nenhuma outra regra se aplica',
    priority: 0,
    preconditions: [],
    blocks: [],
    action: { kind: 'wait', reasonCode: 'SEM_ACAO_APLICAVEL', untilHintMs: null },
    fundamento: 'Art. 9º (INV-07) — sempre há próxima ação OU espera legítima; RO-R7-001',
  },

  // ── Onboarding e conversa ──────────────────────────────────────────────────
  {
    ref: 'RO-CONV-GREET-001',
    title: 'Acolher no primeiro contato',
    priority: 60,
    preconditions: [
      { fact: 'isFirstTurn', op: 'eq', value: true },
      { fact: 'perceptKind', op: 'eq', value: 'text' },
    ],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: { kind: 'conversation', directive: 'speak', speechAct: 'greet', topic: 'boas-vindas', references: [], urgency: 'normal' },
    fundamento: 'Art. 15º (assistiva) + RO-R8-001 (acolhimento)',
  },
  {
    ref: 'RO-CONV-EXPLAIN-DEFAULT-001',
    title: 'Acompanhar/explicar em turno de texto sem pendência específica',
    priority: 20,
    preconditions: [
      { fact: 'perceptKind', op: 'eq', value: 'text' },
      { fact: 'isFirstTurn', op: 'eq', value: false },
    ],
    blocks: [
      { fact: 'hasPendingDocuments', op: 'truthy' },
      { fact: 'matterRequiresHuman', op: 'truthy' },
    ],
    action: { kind: 'conversation', directive: 'speak', speechAct: 'explain', topic: 'acompanhamento', references: [], urgency: 'normal' },
    fundamento: 'Art. 15º + RO-R8-002 (continuidade da conversa)',
  },

  // ── Documentos ─────────────────────────────────────────────────────────────
  {
    ref: 'RO-DOC-REQUEST-001',
    title: 'Pedir documentos pendentes',
    priority: 70,
    preconditions: [{ fact: 'hasPendingDocuments', op: 'truthy' }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'await_documents',
      speechAct: 'request_document',
      topic: 'documentos pendentes',
      references: ['pendingDocuments'],
      urgency: 'normal',
    },
    fundamento: 'RO-R4-003 (coleta de documentos) — assistiva; RO-R7-001',
  },
  {
    ref: 'RO-DOC-RECOGNIZE-001',
    title: 'Invocar reconhecimento de documento percebido',
    priority: 80,
    preconditions: [
      { fact: 'hasArtifacts', op: 'truthy' },
      { fact: 'perceptKind', op: 'in', value: ['pdf', 'document', 'image'] },
    ],
    blocks: [
      { fact: 'matterRequiresHuman', op: 'truthy' },
      { fact: 'canonSilent', op: 'truthy' },
    ],
    action: { kind: 'use_case', useCase: 'RecognizeDocument', references: ['artefato-documental-percebido'] },
    fundamento: 'Entidade 03 (DOCUMENTO) — reconhecimento é ato de domínio via fábrica; RO-R3-001',
  },

  // ── Prazos ─────────────────────────────────────────────────────────────────
  {
    ref: 'RO-DEADLINE-WARN-001',
    title: 'Avisar o cliente sobre prazo próximo',
    priority: 75,
    preconditions: [
      { fact: 'hasDeadline', op: 'truthy' },
      { fact: 'minDeadlineDays', op: 'lte', value: 3 },
    ],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'notify_deadline',
      speechAct: 'deadline_warning',
      topic: 'prazo próximo',
      references: ['deadline'],
      urgency: 'high',
    },
    fundamento: 'RO-R6-002 (gestão de prazos) — aviso assistivo; RO-R7-001',
  },
  {
    ref: 'RO-DEADLINE-NOTIFY-HUMAN-001',
    title: 'Notificar operador sobre prazo crítico',
    priority: 74,
    preconditions: [
      { fact: 'hasDeadline', op: 'truthy' },
      { fact: 'minDeadlineDays', op: 'lte', value: 1 },
    ],
    blocks: [],
    action: { kind: 'notification', channel: 'portal-operacao', audience: 'operador', reasonCode: 'PRAZO_CRITICO' },
    fundamento: 'RO-R6-003 (alerta interno de prazo) — Notification; DF-12',
  },

  // ── Silêncio / timeout / encerramento ──────────────────────────────────────
  {
    ref: 'RO-SILENCE-FOLLOWUP-001',
    title: 'Retomar contato após silêncio',
    priority: 50,
    preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'silence' }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: { kind: 'conversation', directive: 'insist', speechAct: 'follow_up', topic: 'retomar contato', references: [], urgency: 'normal' },
    fundamento: 'RO-R8-004 (reengajamento respeitoso) — assistiva; RO-R7-001',
  },
  {
    ref: 'RO-TIMEOUT-WAIT-001',
    title: 'Aguardar após timeout prolongado',
    priority: 45,
    preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'timeout' }],
    blocks: [],
    action: { kind: 'wait', reasonCode: 'AGUARDAR_CLIENTE', untilHintMs: null },
    fundamento: 'Art. 9º (INV-07) — espera legítima; RO-R7-001',
  },
  {
    ref: 'RO-STOP-CONCLUDED-001',
    title: 'Parar quando a missão está encerrada',
    priority: 90,
    preconditions: [{ fact: 'stateCode', op: 'eq', value: 'ENCERRADA' }],
    blocks: [],
    action: { kind: 'stop', reasonCode: 'MISSAO_ENCERRADA' },
    fundamento: 'Estado Operacional terminal — encerramento; RO-R9-001',
  },
];
