// ─────────────────────────────────────────────────────────────────────────────
// INTENT EMITTER — converte uma AÇÃO ESCOLHIDA (sempre uma regra) na INTENÇÃO
// tipada correspondente, carimbando a PROVENIÊNCIA (DECISOR/TIPO/FUNDAMENTO/REGRA).
// É o único ponto que cria BrainIntent — e só o faz a partir de uma regra. Não gera
// texto, não usa LLM.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { BrainIntent } from './intents.js';
import type { ChosenAction } from './planning.js';
import { automatedProvenance } from './provenance.js';

export class IntentEmitter {
  constructor(
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
  ) {}

  emit(chosen: ChosenAction, missionId: string, chatId: string | null): BrainIntent {
    const rule = chosen.rule;
    const provenance = automatedProvenance(rule.fundamento, rule.ref);
    const base = {
      id: this.uuid.next(),
      missionId,
      chatId,
      provenance,
      formedAt: this.clock.now(),
    };
    const action = rule.action;
    switch (action.kind) {
      case 'conversation':
        return {
          ...base,
          kind: 'conversation',
          directive: action.directive,
          speechAct: action.speechAct,
          topic: action.topic,
          references: action.references,
          urgency: action.urgency,
        };
      case 'use_case':
        return { ...base, kind: 'use_case', useCase: action.useCase, references: action.references };
      case 'escalation':
        return { ...base, kind: 'escalation', role: action.role, reasonCode: action.reasonCode };
      case 'wait':
        return { ...base, kind: 'wait', reasonCode: action.reasonCode, untilHintMs: action.untilHintMs };
      case 'stop':
        return { ...base, kind: 'stop', reasonCode: action.reasonCode };
      case 'notification':
        return {
          ...base,
          kind: 'notification',
          channel: action.channel,
          audience: action.audience,
          reasonCode: action.reasonCode,
        };
    }
  }
}
