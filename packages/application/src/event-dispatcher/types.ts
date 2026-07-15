// ─────────────────────────────────────────────────────────────────────────────
// Event Dispatcher Runtime (Sprint 2A.2) — tipos do LEDGER DE ENTREGAS.
//
// Modelo: uma entrega (`Delivery`) por (evento × subscriber). Isso dá, por
// construção: isolamento entre subscribers (a falha de um não bloqueia os demais),
// ordenação por stream (FIFO por versão dentro de cada stream × subscriber),
// retry/backoff independentes e Dead Letter Queue por entrega. A propagação é
// auditável (attempts/lastError persistidos), determinística e idempotente.
// ─────────────────────────────────────────────────────────────────────────────

/** Estado de uma entrega. `dead` = Dead Letter Queue (mensagem envenenada quarentenada). */
export type DeliveryStatus = 'pending' | 'delivered' | 'dead';

/** Uma entrega individual de um evento a um subscriber. Imutável na leitura. */
export interface Delivery {
  readonly id: string;
  readonly eventId: string;
  readonly subscriber: string;
  // Chaves de ORDENAÇÃO (copiadas do evento) — FIFO por (streamType, streamId, subscriber, version).
  readonly streamType: string;
  readonly streamId: string;
  readonly version: number;
  readonly status: DeliveryStatus;
  readonly attempts: number; // tentativas já realizadas
  readonly nextAttemptAt: Date; // quando pode ser reprocessada (backoff)
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly lockedAt: Date | null; // lock de worker (concorrência / recovery)
  readonly lockedBy: string | null;
}

/** Contagem de entregas por estado (observabilidade). */
export type DeliveryStatusCounts = Readonly<Record<DeliveryStatus, number>>;
