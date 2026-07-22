// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE PROJECTOR — projeção incremental (CQRS) que transforma o Event Store em
// READ MODELS para o Portal Administrativo: timeline por missão, documentos,
// perícias, log de eventos pesquisável e o vínculo conversa↔missão. O PORTAL nunca
// lê o Event Store (item 12; DF-08): lê ESTES read models; o projetor é backend.
// Incremental por globalSeq; determinístico; nunca muta domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type { EventStore, StoredEvent } from '../event-store/index.js';

export interface TimelineEntry {
  readonly globalSeq: number;
  readonly at: Date;
  readonly recordedAt: Date;
  readonly streamType: string;
  readonly streamId: string;
  readonly eventType: string;
  readonly isRelevant: boolean;
  readonly actor: string | null;
  readonly operationalRuleRef: string | null;
  readonly fundamento: string | null;
  readonly missionId: string | null;
}

export interface DocumentView {
  readonly documentId: string;
  readonly missionId: string | null;
  readonly contentReference: string | null;
  readonly mimeType: string | null;
  readonly recognizedAt: Date;
  readonly status: 'reconhecido';
}

export interface PericiaView {
  readonly periciaId: string;
  readonly missionId: string | null;
  readonly framedAt: Date;
}

export interface MissionSummary {
  readonly missionId: string;
  readonly chatId: string | null;
  readonly createdAt: Date;
  readonly eventCount: number;
  readonly lastEventAt: Date;
  readonly truthCount: number;
  readonly stateCount: number;
  readonly stageCount: number;
  readonly operationCount: number;
  readonly projectionCount: number;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export class TimelineProjector {
  private lastSeq = 0;
  private readonly log: TimelineEntry[] = [];
  private readonly byMission = new Map<string, TimelineEntry[]>();
  private readonly documents: DocumentView[] = [];
  private readonly pericias: PericiaView[] = [];
  private readonly personToChat = new Map<string, string>();
  private readonly truthToMission = new Map<string, string>();
  private readonly stateToMission = new Map<string, string>();
  private readonly missionToChat = new Map<string, string>();
  private readonly missionCreated = new Map<string, Date>();

  constructor(
    private readonly eventStore: EventStore,
    private readonly batch = 500,
  ) {}

  /** Atualiza os read models com os eventos novos (incremental, idempotente). */
  async refresh(): Promise<void> {
    for (;;) {
      const events = await this.eventStore.readAll(this.lastSeq, this.batch);
      if (events.length === 0) return;
      for (const event of events) {
        this.project(event);
        this.lastSeq = event.globalSeq;
      }
      if (events.length < this.batch) return;
    }
  }

  private resolveMissionId(event: StoredEvent): string | null {
    if (event.streamType === 'mission') return event.streamId;
    const direct = str(event.payload['missionId']);
    if (direct !== null) return direct;
    if (event.streamType === 'operational-stage') {
      const stateId = str(event.payload['stateId']);
      return stateId !== null ? (this.stateToMission.get(stateId) ?? null) : null;
    }
    if (event.streamType === 'projection') {
      const truthId = str(event.payload['truthId']);
      return truthId !== null ? (this.truthToMission.get(truthId) ?? null) : null;
    }
    return null;
  }

  private project(event: StoredEvent): void {
    // Vínculos (joins de projeção).
    if (event.streamType === 'person') {
      const origin = str(event.payload['origin']);
      if (origin !== null && origin.startsWith('WhatsApp:')) {
        this.personToChat.set(event.streamId, origin.slice('WhatsApp:'.length));
      }
    }
    if (event.streamType === 'operational-truth') {
      const missionId = str(event.payload['missionId']);
      if (missionId !== null) this.truthToMission.set(event.streamId, missionId);
    }
    if (event.streamType === 'operational-state') {
      const missionId = str(event.payload['missionId']);
      if (missionId !== null) this.stateToMission.set(event.streamId, missionId);
    }
    if (event.streamType === 'mission') {
      const personId = str(event.payload['beneficiaryPersonId']);
      const chatId = personId !== null ? (this.personToChat.get(personId) ?? null) : null;
      if (chatId !== null) this.missionToChat.set(event.streamId, chatId);
      this.missionCreated.set(event.streamId, event.occurredAt);
    }

    const missionId = this.resolveMissionId(event);
    const entry: TimelineEntry = {
      globalSeq: event.globalSeq,
      at: event.occurredAt,
      recordedAt: event.recordedAt,
      streamType: event.streamType,
      streamId: event.streamId,
      eventType: event.eventType,
      isRelevant: event.isRelevant,
      actor: event.provenance.actor,
      operationalRuleRef: event.provenance.operationalRuleRef,
      fundamento: event.provenance.fundamento,
      missionId,
    };
    this.log.push(entry);
    if (missionId !== null) {
      const list = this.byMission.get(missionId) ?? [];
      list.push(entry);
      this.byMission.set(missionId, list);
    }

    if (event.streamType === 'document') {
      this.documents.push({
        documentId: event.streamId,
        missionId,
        contentReference: str(event.payload['contentReference']),
        mimeType: str(event.payload['mimeType']),
        recognizedAt: event.occurredAt,
        status: 'reconhecido',
      });
    }
    if (event.streamType === 'pericia') {
      this.pericias.push({ periciaId: event.streamId, missionId, framedAt: event.occurredAt });
    }
  }

  // ── Consultas dos read models (o que o portal lê) ───────────────────────────
  missionTimeline(missionId: string): readonly TimelineEntry[] {
    return [...(this.byMission.get(missionId) ?? [])];
  }

  missions(): readonly MissionSummary[] {
    const summaries: MissionSummary[] = [];
    for (const [missionId, entries] of this.byMission) {
      if (!this.missionCreated.has(missionId)) continue;
      const count = (type: string): number => entries.filter((e) => e.streamType === type).length;
      const last = entries[entries.length - 1];
      summaries.push({
        missionId,
        chatId: this.missionToChat.get(missionId) ?? null,
        createdAt: this.missionCreated.get(missionId) ?? entries[0]?.at ?? new Date(0),
        eventCount: entries.length,
        lastEventAt: last?.recordedAt ?? new Date(0),
        truthCount: count('operational-truth'),
        stateCount: count('operational-state'),
        stageCount: count('operational-stage'),
        operationCount: count('operation'),
        projectionCount: count('projection'),
      });
    }
    return summaries;
  }

  missionsOf(chatId: string): readonly string[] {
    const ids: string[] = [];
    for (const [missionId, chat] of this.missionToChat) {
      if (chat === chatId) ids.push(missionId);
    }
    return ids;
  }

  allDocuments(): readonly DocumentView[] {
    return [...this.documents];
  }

  allPericias(): readonly PericiaView[] {
    return [...this.pericias];
  }

  /** Log pesquisável (substring, case-insensitive, sobre tipo/stream/ator/regra). */
  searchLog(query: string, limit = 200): readonly TimelineEntry[] {
    const q = query.trim().toLowerCase();
    const matches =
      q === ''
        ? this.log
        : this.log.filter(
            (e) =>
              e.eventType.toLowerCase().includes(q) ||
              e.streamType.toLowerCase().includes(q) ||
              (e.actor ?? '').toLowerCase().includes(q) ||
              (e.operationalRuleRef ?? '').toLowerCase().includes(q) ||
              e.streamId.toLowerCase().includes(q),
          );
    return matches.slice(Math.max(0, matches.length - limit));
  }
}
