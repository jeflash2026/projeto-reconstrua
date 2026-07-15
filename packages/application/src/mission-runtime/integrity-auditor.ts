// ─────────────────────────────────────────────────────────────────────────────
// EVENT STORE INTEGRITY AUDITOR — o adapter de R9: LÊ os streams da missão pelo
// port `EventStore` e verifica sequência + cadeia de hashes com `assertStreamIntegrity`
// (2A). Depende só de PORTS (EventStore, Hasher) — nada de infra concreta. Verifica;
// não muta.
// ─────────────────────────────────────────────────────────────────────────────
import { assertStreamIntegrity, type EventStore, type Hasher } from '../event-store/index.js';
import type { IntegrityAuditorPort, MissionIntegrityReport } from './ports.js';
import type { MissionIdentity } from './types.js';

export class EventStoreIntegrityAuditor implements IntegrityAuditorPort {
  constructor(
    private readonly eventStore: EventStore,
    private readonly hasher: Hasher,
  ) {}

  async verify(identity: MissionIdentity): Promise<MissionIntegrityReport> {
    const streams: ReadonlyArray<readonly [string, string | null]> = [
      ['person', identity.personId],
      ['cliente', identity.clienteId],
      ['mission', identity.missionId],
      ['case', identity.caseId],
      ['process', identity.processId],
      ['operational-truth', identity.latestTruthId],
      ['operational-state', identity.latestStateId],
      ['operational-stage', identity.latestStageId],
      ['document', identity.lastDocumentId],
      ['event', identity.lastEventId],
    ];
    let checked = 0;
    try {
      for (const [streamType, streamId] of streams) {
        if (streamId === null) continue;
        const events = await this.eventStore.readStream(streamType, streamId, 0);
        assertStreamIntegrity(events, this.hasher);
        checked += 1;
      }
      return { ok: true, streamsChecked: checked, error: null };
    } catch (error) {
      return {
        ok: false,
        streamsChecked: checked,
        error: error instanceof Error ? error.message : 'integridade da cadeia violada',
      };
    }
  }
}
