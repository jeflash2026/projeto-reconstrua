// ─────────────────────────────────────────────────────────────────────────────
// InMemorySnapshotStore — adapter em memória do SnapshotStore. Mantém o snapshot
// mais recente por stream (otimização de reidratação; nunca substitui eventos).
// ─────────────────────────────────────────────────────────────────────────────
import type { Snapshot, SnapshotStore } from '@reconstrua/application';

export class InMemorySnapshotStore implements SnapshotStore {
  private readonly snaps = new Map<string, Snapshot<unknown>>();

  private key(streamType: string, streamId: string): string {
    return `${streamType} ${streamId}`;
  }

  save<S>(snapshot: Snapshot<S>): Promise<void> {
    const existing = this.snaps.get(this.key(snapshot.streamType, snapshot.streamId));
    // Insert-only quanto à história: só sobrepõe se a versão for mais recente.
    if (!existing || snapshot.version >= existing.version) {
      this.snaps.set(this.key(snapshot.streamType, snapshot.streamId), snapshot);
    }
    return Promise.resolve();
  }

  load<S>(streamType: string, streamId: string): Promise<Snapshot<S> | null> {
    const found = this.snaps.get(this.key(streamType, streamId));
    return Promise.resolve(found ? (found as Snapshot<S>) : null);
  }
}
