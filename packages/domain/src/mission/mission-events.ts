// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da Missão — CONTRATOS VAZIOS, sem infraestrutura (por
// decisão do fundador). Sem dispatcher, sem store, sem payload de negócio.
//
// Canon: o nascimento consumado é o marco inicial do histórico da missão
// (elemento de nascimento 7 — "histórico inicial", DF-19) e, no plano dos
// eventos, é reconhecido como Evento Relevante (R4-L04). A classificação e a
// veiculação operacional pertencem a sprints futuras — aqui há apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando uma Missão nasce (semeia o histórico inicial — DF-19, elemento 7). */
export class MissionCreated extends BaseDomainEvent {
  readonly eventName = 'mission.created';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
