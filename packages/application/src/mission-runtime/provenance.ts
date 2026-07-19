// ─────────────────────────────────────────────────────────────────────────────
// Constrói a PROVENIÊNCIA constitucional (Art. 14º; DF-09; DF-13) de cada evento a
// partir da intenção do Brain: DECISOR/TIPO/FUNDAMENTO/REGRA. `factRef` (opcional)
// é o Fato que fundamenta um Evento Relevante (E12-L09; obrigatório se isRelevant).
// ─────────────────────────────────────────────────────────────────────────────
import type { EventProvenance } from '../event-store/index.js';
import type { MissionUseCaseIntent } from './types.js';

export function baseProvenance(intent: MissionUseCaseIntent): EventProvenance {
  // GO-LIVE 10C — quando a missão tem ORIGEM ESTRATÉGICA (Executive Mind), o
  // FUNDAMENTO persistido passa a referenciar decisionId/strategyRef/confidence,
  // tornando a missão rastreável até os fatos que originaram a estratégia.
  // Sem origem (fluxo legado) ⇒ fundamento intacto ⇒ nenhuma missão existente muda.
  const sd = intent.strategicDecision;
  const fundamento =
    sd === undefined
      ? intent.fundamento
      : `${intent.fundamento} | StrategicDecision ${sd.decisionId} (strategyRef=${sd.strategyRef}, confiança=${sd.confidence}): ${sd.decisionReason}`;
  return {
    actor: intent.decisor,
    decisionType: intent.tipo,
    fundamento,
    operationalRuleRef: intent.operationalRuleRef,
  };
}

export function foundedProvenance(intent: MissionUseCaseIntent, factRef: string): EventProvenance {
  return { ...baseProvenance(intent), factRef };
}
