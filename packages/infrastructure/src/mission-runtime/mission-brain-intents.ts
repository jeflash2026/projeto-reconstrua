// ─────────────────────────────────────────────────────────────────────────────
// Projeta as intenções do Executive Brain (2C) nas intenções de Use Case que o
// Mission Runtime executa. SÓ as intenções `use_case` viram trabalho de missão —
// preservando DECISOR/TIPO/FUNDAMENTO/REGRA. As demais (conversation/…) seguem para
// seus consumidores. O Mission Runtime NUNCA cria intenção: só executa as do Brain.
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainIntent, MissionUseCaseIntent } from '@reconstrua/application';

export function toMissionUseCaseIntents(intents: readonly BrainIntent[]): readonly MissionUseCaseIntent[] {
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
    });
  }
  return result;
}
