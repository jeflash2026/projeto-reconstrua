// ─────────────────────────────────────────────────────────────────────────────
// Testes do LegitimacyGate (RO-R7-001) — registro obrigatório, competência humana
// (só escalação), Canon silente para use_case, e caminho legítimo.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { LegitimacyGate } from './legitimacy-gate.js';
import type { BrainFacts } from './facts.js';
import type { OperationalRuleSpec } from './rule.js';

const gate = new LegitimacyGate();

function rule(over: Partial<OperationalRuleSpec>): OperationalRuleSpec {
  return {
    ref: 'RO-X',
    title: 't',
    priority: 10,
    preconditions: [],
    blocks: [],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'inform',
      topic: 't',
      references: [],
      urgency: 'normal',
    },
    fundamento: 'FUND',
    ...over,
  };
}

const noHuman: BrainFacts = { matterRequiresHuman: false, canonSilent: false };

describe('LegitimacyGate (RO-R7-001)', () => {
  it('impede sem registro (fundamento/regra vazios)', () => {
    expect(gate.check(rule({ fundamento: '  ' }), noHuman).legitimate).toBe(false);
    expect(gate.check(rule({ ref: '' }), noHuman).legitimate).toBe(false);
  });

  it('impede atuação da AHRI em matéria humana (só escalação passa)', () => {
    const facts: BrainFacts = { matterRequiresHuman: true, canonSilent: false };
    expect(gate.check(rule({}), facts).legitimate).toBe(false);
    const escalation = rule({ action: { kind: 'escalation', role: 'advogado', reasonCode: 'X' } });
    expect(gate.check(escalation, facts).legitimate).toBe(true);
  });

  it('impede use_case quando o Canon é silente', () => {
    const facts: BrainFacts = { matterRequiresHuman: false, canonSilent: true };
    const uc = rule({ action: { kind: 'use_case', useCase: 'Y', references: [] } });
    expect(gate.check(uc, facts).legitimate).toBe(false);
  });

  it('legítima quando responsável+autorizado+competência+registro+regra', () => {
    expect(gate.check(rule({}), noHuman)).toEqual({ legitimate: true, cause: null });
  });
});
