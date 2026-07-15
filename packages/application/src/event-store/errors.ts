// ─────────────────────────────────────────────────────────────────────────────
// Erros do Event Store. Cada um mapeia uma garantia constitucional:
//  • ConcurrencyConflictError — unicidade da cadeia por stream (E8-L03; Lei 2);
//  • RelevantEventRequiresFactError — Evento Relevante exige Fato (E12-L09);
//  • EventStoreIntegrityError — cadeia reconstituível e verificável (R9; Lei 4).
// ─────────────────────────────────────────────────────────────────────────────
import type { ExpectedVersion, StreamType } from './stored-event.js';

/** Raiz dos erros do Event Store. */
export class EventStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A versão esperada do stream não corresponde à atual (concorrência otimista). */
export class ConcurrencyConflictError extends EventStoreError {
  constructor(
    readonly streamType: StreamType,
    readonly streamId: string,
    readonly expected: ExpectedVersion,
    readonly actualVersion: number,
  ) {
    super(
      `Conflito de concorrência em ${streamType}/${streamId}: esperado ${JSON.stringify(expected)}, versão atual ${String(actualVersion)}.`,
    );
  }
}

/** Tentativa de anexar um Evento Relevante sem Fato que o fundamente (E12-L09). */
export class RelevantEventRequiresFactError extends EventStoreError {
  constructor(
    readonly streamType: StreamType,
    readonly streamId: string,
    readonly eventType: string,
  ) {
    super(
      `Evento Relevante '${eventType}' em ${streamType}/${streamId} exige um Fato reconhecido (factRef) — E12-L09.`,
    );
  }
}

/** A cadeia de eventos de um stream é inconsistente (sequência ou hash quebrados). */
export class EventStoreIntegrityError extends EventStoreError {
  constructor(
    readonly streamType: StreamType,
    readonly streamId: string,
    readonly detail: string,
  ) {
    super(`Integridade da cadeia violada em ${streamType}/${streamId}: ${detail} (R9).`);
  }
}
