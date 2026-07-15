// ─────────────────────────────────────────────────────────────────────────────
// MISSION TRANSACTION RUNTIME — o EventAppender concreto sobre o Event Store (2A).
// É a FRONTEIRA transacional de escrita: `append` grava os eventos e enfileira a
// outbox NA MESMA TRANSAÇÃO (atomicidade — Lei 3; o Dispatcher publica). Os Use
// Cases escrevem SÓ por aqui; nunca tocam infra nem outro caminho de persistência.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AppendResult,
  EventProvenance,
  EventStore,
  ExpectedVersion,
  StreamId,
  StreamType,
  UncommittedEvent,
} from '../event-store/index.js';
import type { EventAppender } from './ports.js';

export class MissionTransactionRuntime implements EventAppender {
  constructor(private readonly eventStore: EventStore) {}

  append(
    streamType: StreamType,
    streamId: StreamId,
    expected: ExpectedVersion,
    events: readonly UncommittedEvent[],
    provenanceDefault: EventProvenance,
  ): Promise<AppendResult> {
    return this.eventStore.append(streamType, streamId, expected, events, provenanceDefault);
  }
}
