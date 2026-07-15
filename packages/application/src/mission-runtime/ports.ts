// ─────────────────────────────────────────────────────────────────────────────
// PORTS do Mission Runtime. Os Use Cases NÃO acessam infraestrutura: usam o port
// `EventAppender` (sobre o Event Store 2A) para persistir, e ports de identidade e
// auditoria. Adapters concretos (in-memory/pg) são injetados.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AppendResult,
  EventProvenance,
  ExpectedVersion,
  StreamId,
  StreamType,
  UncommittedEvent,
} from '../event-store/index.js';
import type { MissionIdentity, MissionUseCaseIntent, UseCaseOutcome } from './types.js';

/** Persistência: o ÚNICO caminho de escrita dos Use Cases é o Event Store (2A).
 *  `append` grava e enfileira a outbox atomicamente (Dispatcher publica). */
export interface EventAppender {
  append(
    streamType: StreamType,
    streamId: StreamId,
    expected: ExpectedVersion,
    events: readonly UncommittedEvent[],
    provenanceDefault: EventProvenance,
  ): Promise<AppendResult>;
}

/** Mapa de identidades por conversa (idempotência + fluxo entre passos/turnos). */
export interface MissionIdentityMap {
  load(chatId: string): Promise<MissionIdentity | null>;
  save(identity: MissionIdentity): Promise<void>;
}

/** Registro de auditoria de execução (rastreabilidade total). */
export interface MissionExecutionRecord {
  readonly id: string;
  readonly chatId: string;
  readonly at: Date;
  readonly intent: MissionUseCaseIntent;
  readonly outcomes: readonly UseCaseOutcome[];
  readonly ok: boolean;
}

export interface MissionAuditSink {
  record(record: MissionExecutionRecord): Promise<void>;
}

/** Relatório de integridade (R9): a cadeia de hashes dos streams da missão é íntegra? */
export interface MissionIntegrityReport {
  readonly ok: boolean;
  readonly streamsChecked: number;
  readonly error: string | null;
}

/** Auditoria de integridade (R9) — LÊ o Event Store e verifica a cadeia (R9/2A).
 *  É leitura+verificação; não muta domínio. */
export interface IntegrityAuditorPort {
  verify(identity: MissionIdentity): Promise<MissionIntegrityReport>;
}
