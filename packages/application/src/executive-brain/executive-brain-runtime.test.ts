// ─────────────────────────────────────────────────────────────────────────────
// Testes E2E do ExecutiveBrainRuntime — o núcleo determinístico. Prova:
//  • toda decisão nasce de REGRA e carrega DECISOR/TIPO/FUNDAMENTO/REGRA;
//  • as seis naturezas de intenção são alcançáveis;
//  • matéria humana / Canon silente ⇒ SÓ escalação (AHRI não atua);
//  • determinismo (mesma entrada → mesma saída);
//  • "nenhuma decisão sem regra": catálogo vazio ⇒ falha fechada;
//  • auditoria completa e rastreável.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import { ExecutiveBrainRuntime, BrainCatalogError } from './executive-brain-runtime.js';
import { DECISOR, DECISION_TYPE_AUTOMATED } from './provenance.js';
import { emptySnapshot, type MissionSnapshot } from './mission-snapshot.js';
import type { BrainContext } from './brain-context.js';
import type { PerceptView } from './facts.js';
import type { OperationalRuleSpec } from './rule.js';
import type { BrainAuditSink, BrainDecisionRecord } from './audit.js';

class InMemoryBrainAuditSinkForTest implements BrainAuditSink {
  private readonly records: BrainDecisionRecord[] = [];
  record(decision: BrainDecisionRecord): Promise<void> {
    this.records.push(decision);
    return Promise.resolve();
  }
  all(): readonly BrainDecisionRecord[] {
    return [...this.records];
  }
}

class TestClock implements Clock {
  now(): Date {
    return new Date('2026-07-14T00:00:00.000Z');
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

const CATALOG: readonly OperationalRuleSpec[] = [
  {
    ref: 'RO-WAIT',
    title: 'wait',
    priority: 0,
    preconditions: [],
    blocks: [],
    action: { kind: 'wait', reasonCode: 'SEM_ACAO', untilHintMs: null },
    fundamento: 'Art.9',
  },
  {
    ref: 'RO-ESC-HUMAN',
    title: 'esc',
    priority: 100,
    preconditions: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    blocks: [],
    action: { kind: 'escalation', role: 'advogado', reasonCode: 'COMPETENCIA' },
    fundamento: 'DF-09',
  },
  {
    ref: 'RO-ESC-CANON',
    title: 'canon',
    priority: 95,
    preconditions: [{ fact: 'canonSilent', op: 'truthy' }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: { kind: 'escalation', role: 'supervisor', reasonCode: 'CANON' },
    fundamento: 'E10',
  },
  {
    ref: 'RO-GREET',
    title: 'greet',
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
    fundamento: 'Art.15',
  },
  {
    ref: 'RO-DOC',
    title: 'doc',
    priority: 70,
    preconditions: [{ fact: 'hasPendingDocuments', op: 'truthy' }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'await_documents',
      speechAct: 'request_document',
      topic: 'documentos',
      references: [],
      urgency: 'normal',
    },
    fundamento: 'RO-R4',
  },
  {
    ref: 'RO-RECOGNIZE',
    title: 'uc',
    priority: 80,
    preconditions: [{ fact: 'hasArtifacts', op: 'truthy' }],
    blocks: [
      { fact: 'matterRequiresHuman', op: 'truthy' },
      { fact: 'canonSilent', op: 'truthy' },
    ],
    action: { kind: 'use_case', useCase: 'RecognizeDocument', references: [] },
    fundamento: 'Ent.03',
  },
  {
    ref: 'RO-DEADLINE',
    title: 'warn',
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
      topic: 'prazo',
      references: [],
      urgency: 'high',
    },
    fundamento: 'RO-R6',
  },
  {
    ref: 'RO-NOTIFY',
    title: 'notify',
    priority: 74,
    preconditions: [
      { fact: 'hasDeadline', op: 'truthy' },
      { fact: 'minDeadlineDays', op: 'lte', value: 1 },
    ],
    blocks: [],
    action: {
      kind: 'notification',
      channel: 'portal',
      audience: 'operador',
      reasonCode: 'PRAZO_CRITICO',
    },
    fundamento: 'RO-R6',
  },
  {
    ref: 'RO-STOP',
    title: 'stop',
    priority: 90,
    preconditions: [{ fact: 'stateCode', op: 'eq', value: 'ENCERRADA' }],
    blocks: [],
    action: { kind: 'stop', reasonCode: 'ENCERRADA' },
    fundamento: 'RO-R9',
  },
];

function brain(auditSink?: InMemoryBrainAuditSinkForTest): ExecutiveBrainRuntime {
  return new ExecutiveBrainRuntime({
    clock: new TestClock(),
    uuid: new SeqUuid(),
    ...(auditSink ? { auditSink } : {}),
  });
}

function ctx(
  percept: Partial<PerceptView>,
  snapshot: Partial<MissionSnapshot>,
  turnCount = 1,
  rules = CATALOG,
): BrainContext {
  return {
    percept: {
      kind: 'text',
      sentiment: 'neutral',
      urgency: 'normal',
      hasArtifacts: false,
      artifactCount: 0,
      silenceMs: null,
      ...percept,
    },
    snapshot: { ...emptySnapshot('m1'), ...snapshot },
    memory: { turnCount, lastOutboundAgoMs: null },
    rules,
    chatId: 'm1',
    now: new Date('2026-07-14T00:00:00.000Z'),
  };
}

describe('ExecutiveBrainRuntime — decisões e proveniência', () => {
  it('toda decisão carrega DECISOR/TIPO/FUNDAMENTO/REGRA', async () => {
    const outcome = await brain().decide(ctx({}, {}));
    expect(outcome.intents.length).toBeGreaterThan(0);
    for (const intent of outcome.intents) {
      expect(intent.provenance.decisor).toBe(DECISOR);
      expect(intent.provenance.tipo).toBe(DECISION_TYPE_AUTOMATED);
      expect(intent.provenance.fundamento.length).toBeGreaterThan(0);
      expect(intent.provenance.operationalRuleRef.length).toBeGreaterThan(0);
    }
  });

  it('primeiro turno de texto ⇒ saudação (conversation/greet)', async () => {
    const outcome = await brain().decide(ctx({ kind: 'text' }, {}, 1));
    expect(outcome.intents[0]?.kind).toBe('conversation');
    expect(outcome.record.chosenRefs).toContain('RO-GREET');
  });

  it('pendência de documentos ⇒ pedir (await_documents)', async () => {
    const outcome = await brain().decide(ctx({ kind: 'text' }, { pendingDocuments: ['rg'] }, 2));
    const conv = outcome.intents.find((i) => i.kind === 'conversation');
    expect(conv?.kind).toBe('conversation');
    expect(outcome.record.chosenRefs).toContain('RO-DOC');
  });

  it('documento percebido ⇒ UseCaseIntent (invoca reconhecimento; sem falar)', async () => {
    const outcome = await brain().decide(
      ctx({ kind: 'pdf', hasArtifacts: true, artifactCount: 1 }, {}, 2),
    );
    expect(outcome.intents.some((i) => i.kind === 'use_case')).toBe(true);
  });

  it('prazo crítico ⇒ avisar (conversation) E notificar (notification) no mesmo turno', async () => {
    const outcome = await brain().decide(
      ctx({ kind: 'text' }, { deadlines: [{ code: 'd1', dueInDays: 1 }] }, 2),
    );
    const kinds = outcome.intents.map((i) => i.kind);
    expect(kinds).toContain('conversation');
    expect(kinds).toContain('notification');
  });

  it('missão encerrada ⇒ StopIntent', async () => {
    const outcome = await brain().decide(ctx({ kind: 'text' }, { stateCode: 'ENCERRADA' }, 2));
    expect(outcome.intents.some((i) => i.kind === 'stop')).toBe(true);
  });

  it('nenhuma regra aplicável ⇒ WaitIntent (fallback com regra)', async () => {
    const outcome = await brain().decide(ctx({ kind: 'reaction' }, {}, 2));
    expect(outcome.intents[0]?.kind).toBe('wait');
    expect(outcome.record.chosenRefs).toContain('RO-WAIT');
  });
});

describe('ExecutiveBrainRuntime — competência humana e Canon silente', () => {
  it('matéria humana ⇒ SÓ escalação (AHRI não atua)', async () => {
    const outcome = await brain().decide(
      ctx({ kind: 'text' }, { matterRequiresHuman: true, pendingDocuments: ['rg'] }, 1),
    );
    expect(outcome.intents).toHaveLength(1);
    expect(outcome.intents[0]?.kind).toBe('escalation');
    expect(outcome.intents.some((i) => i.kind === 'conversation' || i.kind === 'use_case')).toBe(
      false,
    );
    expect(outcome.record.humanRequired).toBe(true);
  });

  it('Canon silente ⇒ escalação ao supervisor', async () => {
    const outcome = await brain().decide(ctx({ kind: 'text' }, { canonSilent: true }, 2));
    const esc = outcome.intents[0];
    expect(esc?.kind).toBe('escalation');
    if (esc?.kind === 'escalation') expect(esc.role).toBe('supervisor');
  });
});

describe('ExecutiveBrainRuntime — determinismo, fail-closed e auditoria', () => {
  it('mesma entrada ⇒ mesma saída (determinístico)', async () => {
    const a = await brain().decide(ctx({ kind: 'text' }, { pendingDocuments: ['rg'] }, 2));
    const b = await brain().decide(ctx({ kind: 'text' }, { pendingDocuments: ['rg'] }, 2));
    expect(a.intents).toEqual(b.intents);
    expect(a.record.chosenRefs).toEqual(b.record.chosenRefs);
  });

  it('catálogo vazio ⇒ falha fechada (nenhuma decisão sem regra)', async () => {
    await expect(brain().decide(ctx({ kind: 'text' }, {}, 2, []))).rejects.toBeInstanceOf(
      BrainCatalogError,
    );
  });

  it('auditoria registra objetivo, avaliações, escolhidas, emitidas e impedidas', async () => {
    const sink = new InMemoryBrainAuditSinkForTest();
    await brain(sink).decide(ctx({ kind: 'text' }, { pendingDocuments: ['rg'] }, 2));
    const records = sink.all();
    expect(records).toHaveLength(1);
    const rec = records[0];
    expect(rec?.evaluations.length).toBe(CATALOG.length);
    expect(rec?.chosenRefs.length).toBeGreaterThan(0);
    expect(rec?.emitted.every((e) => e.provenance.operationalRuleRef.length > 0)).toBe(true);
  });
});
