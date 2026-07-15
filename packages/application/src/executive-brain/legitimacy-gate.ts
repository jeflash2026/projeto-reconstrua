// ─────────────────────────────────────────────────────────────────────────────
// LEGITIMACY GATE (RO-R7-001) — valida CADA ação candidata nas condições de
// legitimidade: RESPONSÁVEL, AUTORIZADO, COMPETÊNCIA, REGISTRO, REGRA. Resultado
// binário e exaustivo (ADR-0002A §4.2): legítima OU impedida (com causa). Não há
// terceiro resultado. Determinístico.
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainFacts } from './facts.js';
import type { OperationalRuleSpec } from './rule.js';

export interface LegitimacyVerdict {
  readonly legitimate: boolean;
  readonly cause: string | null;
}

export interface ImpededAction {
  readonly ref: string;
  readonly cause: string;
}

export class LegitimacyGate {
  check(rule: OperationalRuleSpec, facts: BrainFacts): LegitimacyVerdict {
    // REGISTRO + REGRA: sem fundamento e referência não há registro DF-09 possível.
    if (rule.fundamento.trim() === '' || rule.ref.trim() === '') {
      return { legitimate: false, cause: 'REGISTRO_AUSENTE: fundamento/regra obrigatórios (INV-AH-02)' };
    }
    // COMPETÊNCIA: matéria humana só pode gerar escalação — nunca atuação da AHRI.
    if (facts['matterRequiresHuman'] === true && rule.action.kind !== 'escalation') {
      return {
        legitimate: false,
        cause: 'COMPETENCIA_HUMANA: matéria exige humano; AHRI não pode atuar (DF-09)',
      };
    }
    // AUTORIZADO: ação sobre domínio (use_case) exige que a matéria NÃO seja humana
    // (já garantido acima) e que o Canon não seja silente sobre ela.
    if (rule.action.kind === 'use_case' && facts['canonSilent'] === true) {
      return {
        legitimate: false,
        cause: 'CANON_SILENTE: sem regra do Canon para atuar; declarar incerteza e escalar (E10)',
      };
    }
    // RESPONSÁVEL: a AHRI é responsável operacional pela missão (assumido no domínio).
    return { legitimate: true, cause: null };
  }
}
