// ─────────────────────────────────────────────────────────────────────────────
// Eventos de domínio da Perícia — CONTRATOS VAZIOS, sem infraestrutura.
// Canon: Entidade 13 — a Perícia DERIVA da evolução da missão (R6) quando a fase
// pericial se instala (item 7). O enquadramento é o marco ontológico; a EVOLUÇÃO
// (R6), a produção da prova (Perito), a auditoria e a persistência pertencem a
// outras camadas, não aqui. Este é apenas o contrato.
// ─────────────────────────────────────────────────────────────────────────────
import { BaseDomainEvent } from '../kernel/domain-event.js';

/** Emitido quando a fase pericial é enquadrada como etapa especializada da Missão (Entidade 13; DF-17). */
export class PericiaFramed extends BaseDomainEvent {
  readonly eventName = 'pericia.framed';
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
