// ─────────────────────────────────────────────────────────────────────────────
// ADVOGADO RULE CATALOG (RO-3B) — as Regras Operacionais que fazem o Executive
// Brain decidir a comunicação ao cliente quando o ADVOGADO conclui uma atividade.
// Atividades de andamento (protocolo/despacho/movimentação/distribuição/conclusão)
// → informar o cliente; atividades internas (observação/número/prazo/documento)
// → silêncio ativo (wait). Catálogo NOVO, injetado por chamada — nada congelado muda.
// ─────────────────────────────────────────────────────────────────────────────
import type { OperationalRuleSpec } from '@reconstrua/application';

const ANDAMENTO_KINDS = [
  'advogado_protocolo',
  'advogado_despacho',
  'advogado_movimentacao',
  'advogado_distribuicao',
  'advogado_conclusao',
] as const;

export const ADVOGADO_RULE_CATALOG: readonly OperationalRuleSpec[] = [
  {
    ref: 'RO-3B-WAIT-DEFAULT',
    title: 'Silêncio ativo para atividades internas do advogado',
    priority: 0,
    preconditions: [],
    blocks: [],
    action: { kind: 'wait', reasonCode: 'ATIVIDADE_INTERNA', untilHintMs: null },
    fundamento: 'Art. 9º (INV-07) — espera legítima; RO-R7-001',
  },
  {
    ref: 'RO-3B-INFORM-ANDAMENTO',
    title: 'Informar o cliente sobre andamento jurídico concluído pelo advogado',
    priority: 70,
    preconditions: [{ fact: 'perceptKind', op: 'in', value: [...ANDAMENTO_KINDS] }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'inform',
      topic: 'andamento do seu processo',
      references: ['andamento-juridico'],
      urgency: 'normal',
    },
    fundamento:
      'Art. 15º (assistiva) + RO-R8-002 (continuidade) — comunicação é da AHRI, nunca do advogado; RO-R7-001',
  },
  {
    ref: 'RO-3B-CONCLUSAO-CELEBRATE',
    title: 'Comunicar conclusão com prioridade',
    priority: 80,
    preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'advogado_conclusao' }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'inform',
      topic: 'a conclusão do seu processo',
      references: ['conclusao'],
      urgency: 'high',
    },
    fundamento: 'Art. 15º + RO-R9-001 (encerramento comunicado); RO-R7-001',
  },
];
