// ─────────────────────────────────────────────────────────────────────────────
// Ports do Event Store Runtime (camada Application). São INTERFACES — as
// implementações (PostgreSQL, in-memory) vivem na infraestrutura. Nenhum port
// importa tecnologia.
//
// Fronteira constitucional: a ESCRITA é o Event Store (fonte única — Lei 1/DF-08);
// a LEITURA das interfaces é sempre via Read Models (item 12) — não por estes
// ports diretamente. O `EventSubscriber` alimenta CQRS/Notifications/Workflow/
// Scheduler/Learning/Relationship a partir da memória oficial.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AppendResult,
  EventProvenance,
  ExpectedVersion,
  StoredEvent,
  StreamId,
  StreamType,
  UncommittedEvent,
} from './stored-event.js';

/** Função de hash injetável (implementada na infra com crypto). Determinística. */
export interface Hasher {
  hash(input: string): string;
}

/**
 * O Event Store append-only. `append` grava eventos e enfileira a outbox na MESMA
 * transação (atomicidade — nada se perde, Lei 3). Leituras são ordenadas.
 */
export interface EventStore {
  /**
   * Anexa eventos a um stream sob concorrência otimista. `provenanceDefault` é
   * aplicado aos eventos que não trouxerem proveniência própria.
   * Lança ConcurrencyConflictError / RelevantEventRequiresFactError.
   */
  append(
    streamType: StreamType,
    streamId: StreamId,
    expected: ExpectedVersion,
    events: readonly UncommittedEvent[],
    provenanceDefault?: EventProvenance,
  ): Promise<AppendResult>;

  /** Lê os eventos de um stream, em ordem de versão, a partir de `fromVersion` (exclusive, default 0). */
  readStream(
    streamType: StreamType,
    streamId: StreamId,
    fromVersion?: number,
  ): Promise<readonly StoredEvent[]>;

  /** Lê todos os eventos em ordem global, a partir de `fromGlobalSeq` (exclusive), limitado. */
  readAll(fromGlobalSeq?: number, limit?: number): Promise<readonly StoredEvent[]>;

  /** Versão atual do stream (0 se não existir). */
  streamVersion(streamType: StreamType, streamId: StreamId): Promise<number>;
}

/** Snapshot do estado reconstruído de um stream numa versão (otimização de reidratação). */
export interface Snapshot<S> {
  readonly streamType: StreamType;
  readonly streamId: StreamId;
  readonly version: number;
  readonly state: S;
  readonly createdAt: Date;
}

/** Armazena e recupera snapshots. Insert-only (mantém histórico); leitura do mais recente. */
export interface SnapshotStore {
  save<S>(snapshot: Snapshot<S>): Promise<void>;
  load<S>(streamType: StreamType, streamId: StreamId): Promise<Snapshot<S> | null>;
}

/**
 * Fila de despacho garantido (Transactional Outbox). O drenador lê os eventos não
 * publicados e, após despachá-los, marca-os como publicados. Entrega ao-menos-uma-vez.
 */
export interface OutboxStore {
  fetchUnpublished(limit: number): Promise<readonly StoredEvent[]>;
  markPublished(eventIds: readonly string[]): Promise<void>;
  recordFailure(eventIds: readonly string[]): Promise<void>;
}

/**
 * Assinante de eventos (CQRS, Notifications, Workflow, Scheduler, Learning,
 * Relationship). Deve ser IDEMPOTENTE (entrega ao-menos-uma-vez).
 */
export interface EventSubscriber {
  /** Nome estável do assinante (ex.: 'cqrs', 'notifications'). */
  readonly name: string;
  /** Tipos de evento de interesse; ausente = todos. */
  readonly interestedIn?: readonly string[];
  handle(event: StoredEvent): Promise<void>;
}
