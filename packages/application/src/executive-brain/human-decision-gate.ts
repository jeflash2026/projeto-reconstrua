// ─────────────────────────────────────────────────────────────────────────────
// HUMAN DECISION GATE — decide se a matéria PERTENCE a um humano. Quando a matéria
// exige competência jurídica/técnica, ou o Canon é silente, a decisão NÃO é da
// AHRI: o Brain escala (DF-09; INV-AD/PT; E10). Determinístico. Não decide a fala;
// decide QUEM decide.
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainFacts } from './facts.js';
import type { HumanRole } from './mission-snapshot.js';

export interface HumanAssessment {
  readonly requiresHuman: boolean;
  readonly role: HumanRole;
  readonly reasonCode: string;
}

export class HumanDecisionGate {
  assess(facts: BrainFacts): HumanAssessment {
    if (facts['matterRequiresHuman'] === true) {
      return { requiresHuman: true, role: 'advogado', reasonCode: 'COMPETENCIA_HUMANA' };
    }
    if (facts['canonSilent'] === true) {
      return { requiresHuman: true, role: 'supervisor', reasonCode: 'CANON_SILENTE' };
    }
    return { requiresHuman: false, role: 'supervisor', reasonCode: 'NENHUM' };
  }
}
