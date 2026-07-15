// ─────────────────────────────────────────────────────────────────────────────
// Adapters in-memory dos ports do Executive Brain: catálogo de regras, snapshot de
// missão (Read Model), resolvedor missão↔conversa e sink de auditoria. Determinísticos,
// para testes e modo local. Os adapters reais (Read Models Postgres, warehouse de
// auditoria) entram sem tocar o Brain (são os mesmos ports).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  BrainAuditSink,
  BrainDecisionRecord,
  MissionResolverPort,
  MissionSnapshot,
  MissionSnapshotPort,
  OperationalRuleSpec,
  RuleCatalogPort,
} from '@reconstrua/application';
import { DEFAULT_RULE_CATALOG } from './default-rule-catalog.js';

export class InMemoryRuleCatalog implements RuleCatalogPort {
  constructor(private readonly rules: readonly OperationalRuleSpec[] = DEFAULT_RULE_CATALOG) {}
  all(): Promise<readonly OperationalRuleSpec[]> {
    return Promise.resolve(this.rules);
  }
}

export class InMemoryMissionSnapshotStore implements MissionSnapshotPort {
  private readonly snapshots = new Map<string, MissionSnapshot>();
  set(snapshot: MissionSnapshot): void {
    this.snapshots.set(snapshot.missionId, snapshot);
  }
  load(missionId: string): Promise<MissionSnapshot | null> {
    return Promise.resolve(this.snapshots.get(missionId) ?? null);
  }
}

/** Mapeia conversa → missão 1:1 (chatId = missionId). Substituível por resolvedor real. */
export class ChatIdMissionResolver implements MissionResolverPort {
  resolve(chatId: string): Promise<string> {
    return Promise.resolve(chatId);
  }
}

export class InMemoryBrainAuditSink implements BrainAuditSink {
  private readonly records: BrainDecisionRecord[] = [];
  record(decision: BrainDecisionRecord): Promise<void> {
    this.records.push(decision);
    return Promise.resolve();
  }
  all(): readonly BrainDecisionRecord[] {
    return [...this.records];
  }
  byMission(missionId: string): readonly BrainDecisionRecord[] {
    return this.records.filter((r) => r.missionId === missionId);
  }
}
