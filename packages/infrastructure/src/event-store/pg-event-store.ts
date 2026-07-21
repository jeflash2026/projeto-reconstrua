// ─────────────────────────────────────────────────────────────────────────────
// PgEventStore — implementação de PRODUÇÃO do Event Store sobre PostgreSQL
// (schema event_store, append-only por trigger — Lei 3/DF-11). Concorrência
// otimista via unicidade (stream_type, stream_id, version): duas escritas
// concorrentes para a mesma versão → uma vence, a outra recebe ConcurrencyConflict.
// A outbox é gravada na MESMA transação do evento (atomicidade — nada se perde).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AppendResult,
  EventProvenance,
  EventStore,
  ExpectedVersion,
  Hasher,
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
import type { UuidGenerator } from '@reconstrua/domain';
import type { SqlClient, SqlRow } from './sql-client.js';
import { asDate, rowToStoredEvent } from './event-row.js';

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION;
}

export class PgEventStore implements EventStore {
  constructor(
    private readonly sql: SqlClient,
    private readonly hasher: Hasher,
    private readonly uuid: UuidGenerator,
  ) {}

  append(
    streamType: StreamType,
    streamId: StreamId,
    expected: ExpectedVersion,
    events: readonly UncommittedEvent[],
    provenanceDefault?: EventProvenance,
  ): Promise<AppendResult> {
    return this.sql.transaction(async (tx) => {
      const versionRows = await tx.query<{ v: number }>(
        'SELECT COALESCE(MAX(version), 0)::int AS v FROM event_store.events WHERE stream_type = $1 AND stream_id = $2',
        [streamType, streamId],
      );
      const current = Number(versionRows[0]?.v ?? 0);

      if (expected.kind === 'no-stream' && current !== 0) {
        throw new ConcurrencyConflictError(streamType, streamId, expected, current);
      }
      if (expected.kind === 'exact' && expected.version !== current) {
        throw new ConcurrencyConflictError(streamType, streamId, expected, current);
      }

      let previousHash: string | null = null;
      if (current > 0) {
        const hashRows = await tx.query<{ hash: string }>(
          'SELECT hash FROM event_store.events WHERE stream_type = $1 AND stream_id = $2 ORDER BY version DESC LIMIT 1',
          [streamType, streamId],
        );
        previousHash = hashRows[0] ? String(hashRows[0].hash) : null;
      }

      let version = current;
      const appended: StoredEvent[] = [];

      for (const e of events) {
        const provenance = normalizeProvenance(e.provenance ?? provenanceDefault);
        if (e.isRelevant && provenance.factRef === null) {
          throw new RelevantEventRequiresFactError(streamType, streamId, e.eventType);
        }
        version += 1;
        const id = this.uuid.next();
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

        try {
          const inserted = await tx.query<SqlRow>(
            `INSERT INTO event_store.events
               (id, stream_type, stream_id, version, event_type, is_relevant, payload,
                fact_ref, actor, decision_type, fundamento, operational_rule_ref,
                previous_hash, hash, occurred_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING recorded_at, global_seq`,
            [
              id,
              streamType,
              streamId,
              version,
              e.eventType,
              e.isRelevant,
              // Objeto CRU: o driver serializa para jsonb. JSON.stringify aqui
              // fazia o driver codificar DE NOVO ⇒ jsonb-string (payload chegava
              // como string aos subscribers; missionId/origin viravam undefined).
              e.payload,
              provenance.factRef,
              provenance.actor,
              provenance.decisionType,
              provenance.fundamento,
              provenance.operationalRuleRef,
              previousHash,
              hash,
              e.occurredAt,
            ],
          );
          await tx.query('INSERT INTO event_store.outbox (event_id) VALUES ($1)', [id]);

          const row = inserted[0];
          appended.push({
            ...core,
            id,
            previousHash,
            hash,
            recordedAt: asDate(row?.recorded_at),
            globalSeq: Number(row?.global_seq ?? 0),
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConcurrencyConflictError(streamType, streamId, expected, version - 1);
          }
          throw error;
        }
        previousHash = hash;
      }

      return { events: appended, version };
    });
  }

  async readStream(
    streamType: StreamType,
    streamId: StreamId,
    fromVersion = 0,
  ): Promise<readonly StoredEvent[]> {
    const rows = await this.sql.query<SqlRow>(
      'SELECT * FROM event_store.events WHERE stream_type = $1 AND stream_id = $2 AND version > $3 ORDER BY version ASC',
      [streamType, streamId, fromVersion],
    );
    return rows.map(rowToStoredEvent);
  }

  async readAll(fromGlobalSeq = 0, limit = 1000): Promise<readonly StoredEvent[]> {
    const rows = await this.sql.query<SqlRow>(
      'SELECT * FROM event_store.events WHERE global_seq > $1 ORDER BY global_seq ASC LIMIT $2',
      [fromGlobalSeq, limit],
    );
    return rows.map(rowToStoredEvent);
  }

  async streamVersion(streamType: StreamType, streamId: StreamId): Promise<number> {
    const rows = await this.sql.query<{ v: number }>(
      'SELECT COALESCE(MAX(version), 0)::int AS v FROM event_store.events WHERE stream_type = $1 AND stream_id = $2',
      [streamType, streamId],
    );
    return Number(rows[0]?.v ?? 0);
  }
}
