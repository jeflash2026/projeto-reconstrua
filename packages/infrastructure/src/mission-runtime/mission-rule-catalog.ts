// ─────────────────────────────────────────────────────────────────────────────
// MISSION RULE CATALOG — catálogo de Regras Operacionais (2D) que faz o Executive
// Brain (2C) DECIDIR executar trabalho de missão. Cada regra emite `use_case`
// (OnboardClient/IngestDocument) e/ou `conversation` (a resposta ao cliente). É um
// catálogo NOVO injetado no Brain via RuleCatalogPort — NÃO altera o catálogo de 2C.
//
// Regras-meta (escalação/espera) presentes: o Brain nunca fica sem regra.
// ─────────────────────────────────────────────────────────────────────────────
import type { OperationalRuleSpec } from '@reconstrua/application';

export const MISSION_RULE_CATALOG: readonly OperationalRuleSpec[] = [
  {
    ref: 'RO-2D-WAIT-DEFAULT',
    title: 'Esperar quando nenhuma outra regra se aplica',
    priority: 0,
    preconditions: [],
    blocks: [],
    action: { kind: 'wait', reasonCode: 'SEM_ACAO_APLICAVEL', untilHintMs: null },
    fundamento: 'Art. 9º (INV-07); RO-R7-001',
  },
  {
    ref: 'RO-2D-ESCALATE-HUMAN',
    title: 'Escalar matéria de competência humana',
    priority: 100,
    preconditions: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    blocks: [],
    action: { kind: 'escalation', role: 'advogado', reasonCode: 'COMPETENCIA_HUMANA' },
    fundamento: 'DF-09; INV-AD-01/02; RO-R7-001',
  },
  // ── Flow 1 (GO-LIVE 9C): onboarding SÓ nasce de FATO — pedido percebido ou
  // documento. Conversa iniciada (saudação, smalltalk, primeiro turno) NUNCA
  // promove relacionamento a onboarding: "Olá" não abre cadastro.
  {
    ref: 'RO-2D-ONBOARD',
    title: 'Iniciar missão quando a pessoa PEDE atendimento (propósito percebido)',
    priority: 58,
    preconditions: [
      { fact: 'perceptKind', op: 'eq', value: 'text' },
      { fact: 'perceptPurpose', op: 'eq', value: 'service_request' },
      { fact: 'onboardingExists', op: 'falsy' },
    ],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: { kind: 'use_case', useCase: 'OnboardClient', references: [] },
    fundamento:
      'R1/R2 + nascimento da Missão (INV-17) + R6; RO-R7-001; GO-LIVE 9C (relação ≠ onboarding)',
  },
  {
    ref: 'RO-2D-ONBOARD-DOC',
    title: 'Iniciar missão quando um DOCUMENTO chega sem atendimento aberto (pedido implícito)',
    priority: 58,
    preconditions: [
      { fact: 'perceptKind', op: 'in', value: ['pdf', 'document', 'image'] },
      { fact: 'onboardingExists', op: 'falsy' },
    ],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: { kind: 'use_case', useCase: 'OnboardClient', references: ['artefato-documental'] },
    fundamento:
      'R1/R2 + INV-17 — o documento é fato de domínio que inaugura o atendimento; GO-LIVE 9C',
  },
  {
    ref: 'RO-2D-GREET',
    title: 'Acolher o cliente no primeiro contato',
    priority: 60,
    preconditions: [
      { fact: 'isFirstTurn', op: 'eq', value: true },
      { fact: 'perceptKind', op: 'eq', value: 'text' },
    ],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'greet',
      topic: 'boas-vindas',
      references: [],
      urgency: 'normal',
    },
    fundamento: 'Art. 15º (assistiva) + RO-R8-001',
  },
  // ── Flows 2 & 3: documento → ingestão + resposta ───────────────────────────
  {
    ref: 'RO-2D-INGEST-DOC',
    title: 'Ingerir documento (R3→R4→R5→Verdade→Estado→Etapa)',
    priority: 70,
    preconditions: [
      { fact: 'perceptKind', op: 'in', value: ['pdf', 'document', 'image'] },
      { fact: 'hasArtifacts', op: 'truthy' },
    ],
    blocks: [
      { fact: 'matterRequiresHuman', op: 'truthy' },
      { fact: 'canonSilent', op: 'truthy' },
    ],
    action: { kind: 'use_case', useCase: 'IngestDocument', references: ['artefato-documental'] },
    fundamento: 'R3 (Documento) + R4 (Evento) + R5 (Conhecimento) + R6; RO-R3-001',
  },
  {
    ref: 'RO-2D-DOC-ACK',
    title: 'Confirmar ao cliente o recebimento do documento',
    priority: 50,
    preconditions: [{ fact: 'perceptKind', op: 'in', value: ['pdf', 'document', 'image'] }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'inform',
      topic: 'documento recebido',
      references: [],
      urgency: 'normal',
    },
    fundamento: 'Art. 15º + RO-R8-002 (continuidade)',
  },
  // ── GO-LIVE 9B: RELACIONAMENTO ≠ CASO. O antigo RO-2D-EXPLAIN (topic
  // 'acompanhamento' em QUALQUER 2º turno) confundia continuidade de conversa com
  // acompanhamento de caso. Agora o Planner decide sobre o FATO `caseExists`
  // (Truth Layer: identidade/missão no domínio) — nunca sobre conversa/memória.
  {
    ref: 'RO-2D-RELATE',
    title: 'Manter a conversa em turnos subsequentes SEM caso no domínio',
    priority: 20,
    preconditions: [
      { fact: 'perceptKind', op: 'eq', value: 'text' },
      { fact: 'isFirstTurn', op: 'eq', value: false },
      { fact: 'caseExists', op: 'falsy' },
    ],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'explain',
      topic: 'relacionamento',
      references: [],
      urgency: 'normal',
    },
    fundamento: 'Art. 15º + RO-R8-002; GO-LIVE 9B (relação ≠ caso)',
  },
  {
    ref: 'RO-2D-CASE-FOLLOW',
    title: 'Acompanhar o CASO em turnos subsequentes (fato de domínio presente)',
    priority: 20,
    preconditions: [
      { fact: 'perceptKind', op: 'eq', value: 'text' },
      { fact: 'isFirstTurn', op: 'eq', value: false },
      { fact: 'caseExists', op: 'truthy' },
    ],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'explain',
      topic: 'acompanhamento do caso',
      references: [],
      urgency: 'normal',
    },
    fundamento: 'Art. 15º + RO-R8-002; GO-LIVE 9B (só com caseExists da Truth Layer)',
  },
];
