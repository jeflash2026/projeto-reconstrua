// ─────────────────────────────────────────────────────────────────────────────
// Projeta as intenções do Executive Brain (2C) nas intenções de Use Case que o
// Mission Runtime executa. SÓ as intenções `use_case` viram trabalho de missão —
// preservando DECISOR/TIPO/FUNDAMENTO/REGRA. As demais (conversation/…) seguem para
// seus consumidores. O Mission Runtime NUNCA cria intenção: só executa as do Brain.
//
// GO-LIVE 10C — Planner Integration: quando o Executive Mind já deliberou uma
// StrategicDecision, ela é CARIMBADA (origem estratégica) em cada intenção de
// missão — o Planner NÃO compara nem escolhe: apenas executa e registra a origem.
// Sem decisão (undefined/null) ⇒ fluxo LEGADO idêntico. A projeção é pura: NÃO
// consulta Strategic Reasoning nem catálogos — só carimba o que já foi decidido.
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainIntent, MissionStrategicOrigin, MissionUseCaseIntent, StrategicDecision } from '@reconstrua/application';

function toStrategicOrigin(decision: StrategicDecision): MissionStrategicOrigin {
  return {
    decisionId: decision.decisionId,
    strategyRef: decision.strategyRef,
    confidence: decision.confidence,
    decisionReason: decision.why,
  };
}

export function toMissionUseCaseIntents(
  intents: readonly BrainIntent[],
  decision?: StrategicDecision | null,
): readonly MissionUseCaseIntent[] {
  const origin = decision === undefined || decision === null ? undefined : toStrategicOrigin(decision);
  const result: MissionUseCaseIntent[] = [];
  for (const intent of intents) {
    if (intent.kind !== 'use_case') continue;
    result.push({
      useCase: intent.useCase,
      references: intent.references,
      decisor: intent.provenance.decisor,
      tipo: intent.provenance.tipo,
      fundamento: intent.provenance.fundamento,
      operationalRuleRef: intent.provenance.operationalRuleRef,
      // exactOptionalPropertyTypes: só inclui a chave quando há origem estratégica.
      ...(origin === undefined ? {} : { strategicDecision: origin }),
    });
  }
  // Correção GO-LIVE (defeito real do primeiro HISCON): quando OnboardClient e
  // IngestDocument saem no MESMO turno (cliente novo cuja PRIMEIRA ação é enviar
  // o documento), a ordem por prioridade executava R3 ANTES da missão existir —
  // "pré-condição ausente: Missão (INV-D08)" — e o documento perdia a vez.
  // OnboardClient roda SEMPRE primeiro: é a ordem que o próprio INV-D08 impõe
  // (a missão precede o documento). Sort estável: o resto preserva a ordem.
  return [...result].sort((a, b) =>
    a.useCase === 'OnboardClient' && b.useCase !== 'OnboardClient' ? -1 : b.useCase === 'OnboardClient' && a.useCase !== 'OnboardClient' ? 1 : 0,
  );
}
