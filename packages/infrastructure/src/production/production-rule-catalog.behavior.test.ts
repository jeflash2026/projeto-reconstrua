// ─────────────────────────────────────────────────────────────────────────────
// PROVA DE COMPORTAMENTO — CAT-01. Executa o Executive Brain REAL contra o
// PRODUCTION_RULE_CATALOG REAL e prova, para as duas regras reconectadas
// (RO-DEADLINE-WARN-001 e RO-META-ESCALATE-CANON-001):
//   1) os fatos de entrada (buildFacts);
//   2) a avaliação do RuleEvaluator (aplicável/bloqueado);
//   3) a regra vencedora (maior prioridade aplicável);
//   4) a intenção produzida pelo Brain;
//   5) regressão: nenhuma regra 2D/4C existente deixou de disparar quando deveria.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import {
  ExecutiveBrainRuntime,
  RuleEvaluator,
  buildFacts,
  emptySnapshot,
  type BrainContext,
  type MissionSnapshot,
  type PerceptView,
} from '@reconstrua/application';
import { PRODUCTION_RULE_CATALOG } from './production-rule-catalog.js';

class TestClock implements Clock {
  now(): Date {
    return new Date('2026-07-16T00:00:00.000Z');
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

function brain(): ExecutiveBrainRuntime {
  return new ExecutiveBrainRuntime({ clock: new TestClock(), uuid: new SeqUuid() });
}

function perceptOf(over: Partial<PerceptView>): PerceptView {
  return { kind: 'text', sentiment: 'neutral', urgency: 'normal', hasArtifacts: false, artifactCount: 0, silenceMs: null, ...over };
}
function snapshotOf(over: Partial<MissionSnapshot>): MissionSnapshot {
  return { ...emptySnapshot('m1'), ...over };
}
function ctx(percept: Partial<PerceptView>, snapshot: Partial<MissionSnapshot>, turnCount = 2): BrainContext {
  return {
    percept: perceptOf(percept),
    snapshot: snapshotOf(snapshot),
    memory: { turnCount, lastOutboundAgoMs: null },
    rules: PRODUCTION_RULE_CATALOG,
    chatId: 'm1',
    now: new Date('2026-07-16T00:00:00.000Z'),
  };
}

/** Regra vencedora = maior prioridade entre as APLICÁVEIS (espelha a seleção do Brain). */
function winner(percept: Partial<PerceptView>, snapshot: Partial<MissionSnapshot>, turnCount = 2): string | null {
  const facts = buildFacts(perceptOf(percept), snapshotOf(snapshot), { turnCount, lastOutboundAgoMs: null });
  const evals = new RuleEvaluator().evaluateAll(PRODUCTION_RULE_CATALOG, facts);
  const applicable = evals.filter((e) => e.applicable).sort((a, b) => b.priority - a.priority);
  return applicable[0]?.ref ?? null;
}

describe('CAT-01 · composição do catálogo (trava de regressão)', () => {
  const refs = PRODUCTION_RULE_CATALOG.map((r) => r.ref);
  it('contém as regras reconectadas e as bases 2D/4C', () => {
    for (const ref of [
      'RO-DEADLINE-WARN-001',
      'RO-META-ESCALATE-CANON-001',
      'RO-STOP-CONCLUDED-001', // B4.1 — encerramento oficial ativado
      'RO-4C-FOLLOWUP-SILENCE',
      'RO-4C-FOLLOWUP-TIMEOUT',
      'RO-2D-ONBOARD',
      'RO-2D-GREET',
      'RO-2D-INGEST-DOC',
      'RO-2D-ESCALATE-HUMAN',
    ]) {
      expect(refs).toContain(ref);
    }
  });
  it('NÃO contém as regras adiadas para sprints próprios', () => {
    for (const ref of ['RO-DOC-REQUEST-001', 'RO-DEADLINE-NOTIFY-HUMAN-001']) {
      expect(refs).not.toContain(ref);
    }
  });
});

describe('CAT-01 · RO-DEADLINE-WARN-001 (avisar prazo ≤3 dias)', () => {
  const percept = { kind: 'text' as const };
  const snapshot = { deadlines: [{ code: 'd1', dueInDays: 2 }] };

  it('1) fatos: hasDeadline=true, minDeadlineDays=2', () => {
    const facts = buildFacts(perceptOf(percept), snapshotOf(snapshot), { turnCount: 2, lastOutboundAgoMs: null });
    expect(facts['hasDeadline']).toBe(true);
    expect(facts['minDeadlineDays']).toBe(2);
    expect(facts['matterRequiresHuman']).toBe(false);
  });
  it('2) avaliação: a regra é aplicável', () => {
    const facts = buildFacts(perceptOf(percept), snapshotOf(snapshot), { turnCount: 2, lastOutboundAgoMs: null });
    const evalWarn = new RuleEvaluator().evaluateAll(PRODUCTION_RULE_CATALOG, facts).find((e) => e.ref === 'RO-DEADLINE-WARN-001');
    expect(evalWarn?.matched).toBe(true);
    expect(evalWarn?.applicable).toBe(true);
  });
  it('3) regra vencedora = RO-DEADLINE-WARN-001', () => {
    expect(winner(percept, snapshot)).toBe('RO-DEADLINE-WARN-001');
  });
  it('4) intenção: conversa deadline_warning', async () => {
    const outcome = await brain().decide(ctx(percept, snapshot));
    expect(outcome.record.chosenRefs).toContain('RO-DEADLINE-WARN-001');
    const conv = outcome.intents.find((i) => i.kind === 'conversation');
    expect(conv?.kind).toBe('conversation');
    if (conv?.kind === 'conversation') expect(conv.speechAct).toBe('deadline_warning');
  });
});

describe('CAT-01 · RO-META-ESCALATE-CANON-001 (Canon silente → supervisor)', () => {
  const percept = { kind: 'text' as const };
  const snapshot = { canonSilent: true };

  it('1) fatos: canonSilent=true', () => {
    const facts = buildFacts(perceptOf(percept), snapshotOf(snapshot), { turnCount: 2, lastOutboundAgoMs: null });
    expect(facts['canonSilent']).toBe(true);
  });
  it('2) avaliação: aplicável e não bloqueada', () => {
    const facts = buildFacts(perceptOf(percept), snapshotOf(snapshot), { turnCount: 2, lastOutboundAgoMs: null });
    const e = new RuleEvaluator().evaluateAll(PRODUCTION_RULE_CATALOG, facts).find((x) => x.ref === 'RO-META-ESCALATE-CANON-001');
    expect(e?.applicable).toBe(true);
  });
  it('3) regra vencedora = RO-META-ESCALATE-CANON-001', () => {
    expect(winner(percept, snapshot)).toBe('RO-META-ESCALATE-CANON-001');
  });
  it('4) intenção: escalação ao supervisor (e SÓ escalação — AHRI não atua)', async () => {
    const outcome = await brain().decide(ctx(percept, snapshot));
    expect(outcome.record.chosenRefs).toContain('RO-META-ESCALATE-CANON-001');
    expect(outcome.intents).toHaveLength(1);
    const esc = outcome.intents[0];
    expect(esc?.kind).toBe('escalation');
    if (esc?.kind === 'escalation') expect(esc.role).toBe('supervisor');
  });
});

describe('B4.1 · RO-STOP-CONCLUDED-001 (missão ENCERRADA → PARA, sem acompanhamento)', () => {
  const encerrada = { stateCode: 'ENCERRADA' };

  it('1) fatos: stateCode=ENCERRADA', () => {
    const facts = buildFacts(perceptOf({ kind: 'timeout' }), snapshotOf(encerrada), { turnCount: 5, lastOutboundAgoMs: null });
    expect(facts['stateCode']).toBe('ENCERRADA');
  });
  it('2) avaliação: RO-STOP-CONCLUDED-001 aplicável; follow-ups BLOQUEADOS', () => {
    const facts = buildFacts(perceptOf({ kind: 'timeout' }), snapshotOf(encerrada), { turnCount: 5, lastOutboundAgoMs: null });
    const evals = new RuleEvaluator().evaluateAll(PRODUCTION_RULE_CATALOG, facts);
    expect(evals.find((e) => e.ref === 'RO-STOP-CONCLUDED-001')?.applicable).toBe(true);
    expect(evals.find((e) => e.ref === 'RO-4C-FOLLOWUP-TIMEOUT')?.applicable).toBe(false);
    expect(evals.find((e) => e.ref === 'RO-4C-FOLLOWUP-SILENCE')?.applicable).toBe(false);
  });
  it('3) regra vencedora em silêncio E timeout = RO-STOP-CONCLUDED-001', () => {
    expect(winner({ kind: 'timeout' }, encerrada)).toBe('RO-STOP-CONCLUDED-001');
    expect(winner({ kind: 'silence', silenceMs: 120000 }, encerrada)).toBe('RO-STOP-CONCLUDED-001');
  });
  it('4) intenção: STOP — a AHRI não fala, jamais acompanha um processo encerrado', async () => {
    const outcome = await brain().decide(ctx({ kind: 'timeout' }, encerrada, 5));
    expect(outcome.record.chosenRefs).toContain('RO-STOP-CONCLUDED-001');
    expect(outcome.intents.some((i) => i.kind === 'conversation')).toBe(false);
    expect(outcome.intents.some((i) => i.kind === 'stop')).toBe(true);
  });
});

describe('CAT-01 · regressão — regras existentes ainda disparam quando devem', () => {
  it('primeiro turno de texto ⇒ ONBOARD (missão nasce) + GREET (acolhe)', async () => {
    const outcome = await brain().decide(ctx({ kind: 'text' }, {}, 1));
    expect(outcome.record.chosenRefs).toContain('RO-2D-ONBOARD');
    expect(outcome.record.chosenRefs).toContain('RO-2D-GREET');
    expect(outcome.intents.some((i) => i.kind === 'use_case')).toBe(true);
  });
  it('silêncio ⇒ RO-4C-FOLLOWUP-SILENCE (reengaja)', async () => {
    const outcome = await brain().decide(ctx({ kind: 'silence', silenceMs: 120000 }, {}));
    expect(outcome.record.chosenRefs).toContain('RO-4C-FOLLOWUP-SILENCE');
  });
  it('timeout COM caso ⇒ RO-4C-FOLLOWUP-TIMEOUT (fala do caso — GO-LIVE 9B)', async () => {
    const outcome = await brain().decide(ctx({ kind: 'timeout' }, { caseExists: true }));
    expect(outcome.record.chosenRefs).toContain('RO-4C-FOLLOWUP-TIMEOUT');
  });
  it('timeout SEM caso ⇒ RO-4C-FOLLOWUP-TIMEOUT-RELATE (retoma a conversa; nunca afirma caso)', async () => {
    const outcome = await brain().decide(ctx({ kind: 'timeout' }, {}));
    expect(outcome.record.chosenRefs).toContain('RO-4C-FOLLOWUP-TIMEOUT-RELATE');
    expect(outcome.record.chosenRefs).not.toContain('RO-4C-FOLLOWUP-TIMEOUT');
  });
  it('documento percebido ⇒ RO-2D-INGEST-DOC (use_case)', async () => {
    const outcome = await brain().decide(ctx({ kind: 'pdf', hasArtifacts: true, artifactCount: 1 }, {}));
    expect(outcome.record.chosenRefs).toContain('RO-2D-INGEST-DOC');
    expect(outcome.intents.some((i) => i.kind === 'use_case')).toBe(true);
  });
  it('matéria humana ⇒ SÓ RO-2D-ESCALATE-HUMAN — a nova regra de prazo é BLOQUEADA', async () => {
    const outcome = await brain().decide(ctx({ kind: 'text' }, { matterRequiresHuman: true, deadlines: [{ code: 'd', dueInDays: 2 }] }));
    expect(outcome.record.chosenRefs).toContain('RO-2D-ESCALATE-HUMAN');
    expect(outcome.intents).toHaveLength(1);
    expect(outcome.intents[0]?.kind).toBe('escalation');
    expect(outcome.intents.some((i) => i.kind === 'conversation')).toBe(false); // deadline_warning suprimido
  });
});
