// ─────────────────────────────────────────────────────────────────────────────
// InMemoryEventStore — adapter de ALTA FIDELIDADE do Event Store, em memória.
// NÃO é um mock: implementa fielmente o contrato (append-only, concorrência
// otimista, encadeamento de hash, Transactional Outbox, Evento Relevante exige
// Fato). Serve a testes, execução local e como implementação de referência do
// contrato que o PgEventStore também satisfaz.
//
// Append-only por construção: a lista interna só recebe `push`; não há operação de
// UPDATE/DELETE (Lei 3; DF-11). Atomicidade por tick: `append` executa seu corpo de
// forma SÍNCRONA (sem await) e só então retorna a Promise; dois appends concorrentes
// ao mesmo stream resolvem-se deterministicamente — o segundo vê a versão já
// atualizada e conflita.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AppendResult,
  EventProvenance,
  EventStore,
  ExpectedVersion,
  Hasher,
  OutboxStore,
  StoredEvent,
  StreamId,
  StreamType,
  UncommittedEvent,
} from '@reconstrua/application';
import {
  ConcurrencyConflictError,
  RelevantEventRequiresFactError,
  computeHash,
  normalizeProvenance,
} from '@reconstrua/application';
import type { Clock, UuidGenerator } from '@reconstrua/domain';

interface OutboxEntry {
  published: boolean;
  attempts: number;
}

export class InMemoryEventStore implements EventStore, OutboxStore {
  private readonly log: StoredEvent[] = [];
  private readonly versions = new Map<string, number>();
  private readonly outbox = new Map<string, OutboxEntry>();
  private globalSeq = 0;

  constructor(
    private readonly hasher: Hasher,
    private readonly uuid: UuidGenerator,
    private readonly clock: Clock,
  ) {}

  private key(streamType: StreamType, streamId: StreamId): string {
    return `${streamType} ${streamId}`;
  }

  // ── EventStore ────────────────────────────────────────────────────────────
  append(
    streamType: StreamType,
    streamId: StreamId,
    expected: ExpectedVersion,
    events: readonly UncommittedEvent[],
    provenanceDefault?: EventProvenance,
  ): Promise<AppendResult> {
    const key = this.key(streamType, streamId);
    const current = this.versions.get(key) ?? 0;

    if (expected.kind === 'no-stream' && current !== 0) {
      return Promise.reject(new ConcurrencyConflictError(streamType, streamId, expected, current));
    }
    if (expected.kind === 'exact' && expected.version !== current) {
      return Promise.reject(new ConcurrencyConflictError(streamType, streamId, expected, current));
    }

    let previousHash: string | null = current > 0 ? this.lastHashOf(streamType, streamId) : null;
    let version = current;
    const appended: StoredEvent[] = [];

    for (const e of events) {
      const provenance = normalizeProvenance(e.provenance ?? provenanceDefault);
      if (e.isRelevant && provenance.factRef === null) {
        return Promise.reject(new RelevantEventRequiresFactError(streamType, streamId, e.eventType));
      }
      version += 1;
      this.globalSeq += 1;
      const core = {
        streamType,
        streamId,
        version,
        eventType: e.eventType,
        isRelevant: e.isRelevant,
        payload: e.payload,
        provenance,
        occurredAt: e.occurredAt,
      };
      const hash = computeHash(previousHash, core, this.hasher);
      const stored: StoredEvent = {
        ...core,
        id: this.uuid.next(),
        previousHash,
        hash,
        recordedAt: this.clock.now(),
        globalSeq: this.globalSeq,
      };
      appended.push(stored);
      previousHash = hash;
    }

    // Commit atômico: só agora o estado compartilhado é tocado (append-only).
    for (const stored of appended) {
      this.log.push(stored);
      this.outbox.set(stored.id, { published: false, attempts: 0 });
    }
    this.versions.set(key, version);

    return Promise.resolve({ events: appended, version });
  }

  private lastHashOf(streamType: StreamType, streamId: StreamId): string {
    for (let i = this.log.length - 1; i >= 0; i -= 1) {
      const e = this.log[i]!;
      if (e.streamType === streamType && e.streamId === streamId) {
        return e.hash;
      }
    }
    return '';
  }

  readStream(
    streamType: StreamType,
    streamId: StreamId,
    fromVersion = 0,
  ): Promise<readonly StoredEvent[]> {
    return Promise.resolve(
      this.log.filter(
        (e) => e.streamType === streamType && e.streamId === streamId && e.version > fromVersion,
      ),
    );
  }

  readAll(fromGlobalSeq = 0, limit = Number.MAX_SAFE_INTEGER): Promise<readonly StoredEvent[]> {
    return Promise.resolve(this.log.filter((e) => e.globalSeq > fromGlobalSeq).slice(0, limit));
  }

  streamVersion(streamType: StreamType, streamId: StreamId): Promise<number> {
    return Promise.resolve(this.versions.get(this.key(streamType, streamId)) ?? 0);
  }

  // ── OutboxStore ───────────────────────────────────────────────────────────
  fetchUnpublished(limit: number): Promise<readonly StoredEvent[]> {
    const pending: StoredEvent[] = [];
    for (const e of this.log) {
      if (pending.length >= limit) break;
      if (this.outbox.get(e.id)?.published === false) {
        pending.push(e);
      }
    }
    return Promise.resolve(pending);
  }

  markPublished(eventIds: readonly string[]): Promise<void> {
    for (const id of eventIds) {
      const entry = this.outbox.get(id);
      if (entry) entry.published = true;
    }
    return Promise.resolve();
  }

  recordFailure(eventIds: readonly string[]): Promise<void> {
    for (const id of eventIds) {
      const entry = this.outbox.get(id);
      if (entry) entry.attempts += 1;
    }
    return Promise.resolve();
  }
}
