// ─────────────────────────────────────────────────────────────────────────────
// Mapeia um Evento de Domínio (contrato congelado do kernel: eventName/occurredAt/
// aggregateId) para um `UncommittedEvent` do Event Store. É o ÚNICO ponto de
// contato entre a memória e os contratos do domínio — e ele apenas LÊ o contrato
// público, nunca o altera. O domínio permanece soberano.
//
// Como os eventos de domínio são contratos mínimos, o payload persistido carrega
// hoje o `aggregateId`; o enriquecimento de payload (futuro, aditivo) entra aqui,
// sem tocar o domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type { DomainEvent } from '@reconstrua/domain';
import type { EventProvenance, UncommittedEvent } from './stored-event.js';

/** Opções por evento no ato de mapear (relevância + proveniência constitucional). */
export interface MapOptions {
  readonly isRelevant: boolean;
  readonly provenance?: EventProvenance;
  /** Payload adicional (aditivo); mesclado sobre o payload-base. */
  readonly payload?: Readonly<Record<string, unknown>>;
}

/** Converte um evento de domínio em evento a ser anexado. */
export function toUncommitted(event: DomainEvent, options: MapOptions): UncommittedEvent {
  const base: Record<string, unknown> = {
    aggregateId: event.aggregateId,
    ...(options.payload ?? {}),
  };
  return {
    eventType: event.eventName,
    isRelevant: options.isRelevant,
    payload: base,
    occurredAt: event.occurredAt,
    ...(options.provenance ? { provenance: options.provenance } : {}),
  };
}
