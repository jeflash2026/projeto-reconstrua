// ─────────────────────────────────────────────────────────────────────────────
// Adapters in-memory dos ports do Mission Runtime: mapa de identidades (idempotência
// + fluxo entre turnos) e sink de auditoria de execução. Determinísticos; os
// adapters reais (Postgres) entram sem tocar os Use Cases (mesmos ports).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  MissionAuditSink,
  MissionExecutionRecord,
  MissionIdentity,
  MissionIdentityMap,
} from '@reconstrua/application';

export class InMemoryMissionIdentityMap implements MissionIdentityMap {
  private readonly byChat = new Map<string, MissionIdentity>();
  load(chatId: string): Promise<MissionIdentity | null> {
    return Promise.resolve(this.byChat.get(chatId) ?? null);
  }
  save(identity: MissionIdentity): Promise<void> {
    this.byChat.set(identity.chatId, identity);
    return Promise.resolve();
  }
}

export class InMemoryMissionAuditSink implements MissionAuditSink {
  private readonly records: MissionExecutionRecord[] = [];
  record(record: MissionExecutionRecord): Promise<void> {
    this.records.push(record);
    return Promise.resolve();
  }
  all(): readonly MissionExecutionRecord[] {
    return [...this.records];
  }
}
