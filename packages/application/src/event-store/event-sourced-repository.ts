// ─────────────────────────────────────────────────────────────────────────────
// EventSourcedRepository<S> — repositório genérico sobre o Event Store: reidrata
// estado a partir dos eventos (com snapshots), anexa novos eventos sob concorrência
// otimista e verifica integridade (R9). É agnóstico do agregado: recebe `seed` +
// `fold` na construção, portanto NÃO altera nem conhece o domínio congelado.
//
// Estratégia de SNAPSHOT (lazy): ao reidratar, se a cauda de eventos desde o último
// snapshot atingir `snapshotEvery`, grava um novo snapshot do estado reconstruído.
// Critério simples, determinístico e sem custo no caminho de escrita. Snapshots são
// otimização — a fonte da verdade continua sendo o event store (nunca substituem
// eventos; Lei 3).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  EventProvenance,
  ExpectedVersion,
  StreamId,
  StreamType,
  UncommittedEvent,
  AppendResult,
} from './stored-event.js';
import type { EventStore, Hasher, SnapshotStore } from './ports.js';
import type { Fold, Rehydrated } from './rehydrator.js';
import { rehydrate } from './rehydrator.js';
import { assertStreamIntegrity } from './hash-chain.js';

export interface EventSourcedRepositoryOptions<S> {
  readonly streamType: StreamType;
  readonly seed: S;
  readonly fold: Fold<S>;
  readonly eventStore: EventStore;
  /** Opcional: sem snapshot store, reidrata sempre do zero (íntegro, porém mais custoso). */
  readonly snapshotStore?: SnapshotStore;
  /** Grava snapshot quando a cauda desde o último atingir este tamanho (default 100). */
  readonly snapshotEvery?: number;
}

export class EventSourcedRepository<S> {
  private readonly streamType: StreamType;
  private readonly seed: S;
  private readonly fold: Fold<S>;
  private readonly eventStore: EventStore;
  private readonly snapshotStore: SnapshotStore | undefined;
  private readonly snapshotEvery: number;

  constructor(options: EventSourcedRepositoryOptions<S>) {
    this.streamType = options.streamType;
    this.seed = options.seed;
    this.fold = options.fold;
    this.eventStore = options.eventStore;
    this.snapshotStore = options.snapshotStore;
    this.snapshotEvery = options.snapshotEvery ?? 100;
  }

  /** Reidrata o estado do stream. Retorna null se o stream não existir (versão 0). */
  async load(streamId: StreamId): Promise<Rehydrated<S> | null> {
    const snapshot = this.snapshotStore
      ? await this.snapshotStore.load<S>(this.streamType, streamId)
      : null;
    const baseVersion = snapshot?.version ?? 0;
    const baseState = snapshot ? snapshot.state : this.seed;

    const tail = await this.eventStore.readStream(this.streamType, streamId, baseVersion);
    const { state, version } = rehydrate(baseState, tail, this.fold, baseVersion);

    if (version === 0) {
      return null;
    }

    if (this.snapshotStore && version - baseVersion >= this.snapshotEvery) {
      await this.snapshotStore.save<S>({
        streamType: this.streamType,
        streamId,
        version,
        state,
        createdAt: new Date(),
      });
    }

    return { state, version };
  }

  /** Anexa eventos sob concorrência otimista (delega ao Event Store). */
  appendEvents(
    streamId: StreamId,
    expected: ExpectedVersion,
    events: readonly UncommittedEvent[],
    provenanceDefault?: EventProvenance,
  ): Promise<AppendResult> {
    return this.eventStore.append(this.streamType, streamId, expected, events, provenanceDefault);
  }

  /** Versão atual do stream (0 se inexistente). */
  currentVersion(streamId: StreamId): Promise<number> {
    return this.eventStore.streamVersion(this.streamType, streamId);
  }

  /** Auditoria de integridade: relê o stream inteiro e verifica sequência + cadeia de hashes (R9). */
  async verifyIntegrity(streamId: StreamId, hasher: Hasher): Promise<void> {
    const events = await this.eventStore.readStream(this.streamType, streamId, 0);
    assertStreamIntegrity(events, hasher);
  }
}
