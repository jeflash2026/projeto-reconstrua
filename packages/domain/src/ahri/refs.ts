// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). A AHRI conhece APENAS por
// identidade:
//   • a Missão de que assume responsabilidade operacional — OBRIGATÓRIA (item 12;
//     DF-09);
//   • a Regra Operacional (12) que fundamenta a atuação — OBRIGATÓRIA (item 11;
//     INV-AH-02; DF-09 FUNDAMENTO).
//
// NÃO há referência a papéis humanos (15–18): o "acionar papéis" é relação de
// INTERAÇÃO, pertencente à OPERAÇÃO (11)/R7 — omitida aqui (recomendação R1 do
// ROLE_ARCHITECTURE_AUDIT), o que elimina a mutualidade nominal e mantém DAG. NÃO
// há referência ao SUPERVISOR (18): a supervisão é do R7, não atributo da AHRI.
// Nenhum comportamento alheio é implementado.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A Missão de que a AHRI assume responsabilidade operacional (Canon: item 12; DF-09). */
export class AhriMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): AhriMissionRef {
    return new AhriMissionRef(id);
  }
  static fromString(id: string): AhriMissionRef {
    return new AhriMissionRef(toUuid(id));
  }
  equals(other?: AhriMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** A Regra Operacional (12) que fundamenta a atuação da AHRI (Canon: item 11; INV-AH-02; DF-09). */
export class GoverningRuleRef {
  private constructor(public readonly ruleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): GoverningRuleRef {
    return new GoverningRuleRef(id);
  }
  static fromString(id: string): GoverningRuleRef {
    return new GoverningRuleRef(toUuid(id));
  }
  equals(other?: GoverningRuleRef | null): boolean {
    return other != null && this.ruleId === other.ruleId;
  }
}
