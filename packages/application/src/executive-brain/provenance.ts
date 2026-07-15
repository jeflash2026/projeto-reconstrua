// ─────────────────────────────────────────────────────────────────────────────
// PROVENIÊNCIA da decisão — o registro DF-09 obrigatório: DECISOR / TIPO /
// FUNDAMENTO / REGRA OPERACIONAL (INV-AH-02; RO-R7-001). Toda decisão do Brain
// carrega este registro; sem ele não há decisão.
//
// DECISOR e TIPO são CONSTANTES da AHRI (importados do domínio congelado — nunca
// redefinidos aqui). Só o FUNDAMENTO e a REGRA variam por decisão.
// ─────────────────────────────────────────────────────────────────────────────
import { AHRI_DECISOR, AHRI_DECISION_TYPE } from '@reconstrua/domain';

export type Decisor = typeof AHRI_DECISOR;
export const DECISOR: Decisor = AHRI_DECISOR;

/** TIPO de decisão: atuação automatizada legítima ou atuação impedida (nenhum terceiro). */
export const DECISION_TYPE_AUTOMATED = AHRI_DECISION_TYPE;
export const DECISION_TYPE_IMPEDED = 'ATUACAO_IMPEDIDA' as const;
export type DecisionType = typeof AHRI_DECISION_TYPE | typeof DECISION_TYPE_IMPEDED;

/** O registro DECISOR/TIPO/FUNDAMENTO/REGRA de uma decisão. Imutável. */
export interface DecisionProvenance {
  readonly decisor: Decisor; // DECISOR — sempre AHRI para atuação automatizada
  readonly tipo: DecisionType; // TIPO
  readonly fundamento: string; // FUNDAMENTO — base constitucional + RO
  readonly operationalRuleRef: string; // REGRA OPERACIONAL — a RO que origina a decisão
}

/** Constrói a proveniência de uma atuação legítima. Exige fundamento e regra. */
export function automatedProvenance(fundamento: string, operationalRuleRef: string): DecisionProvenance {
  return { decisor: DECISOR, tipo: DECISION_TYPE_AUTOMATED, fundamento, operationalRuleRef };
}

/** Constrói a proveniência de uma atuação IMPEDIDA (registrada na auditoria). */
export function impededProvenance(fundamento: string, operationalRuleRef: string): DecisionProvenance {
  return { decisor: DECISOR, tipo: DECISION_TYPE_IMPEDED, fundamento, operationalRuleRef };
}
