// ─────────────────────────────────────────────────────────────────────────────
// Testes do ProjectionBackedMissionSnapshotAdapter (RFC-0035-G). Provam: resolução
// chatId→missionId pelo MissionIdentityMap; missão nova/sem registro ⇒ null (⇒
// emptySnapshot no chamador); overlay de truthEstablished com os demais campos no
// default de emptySnapshot (nada inventado).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { MissionIdentity, MissionIdentityMap } from '@reconstrua/application';
import { emptyIdentity } from '@reconstrua/application';
import { InMemoryDecisionStateStore } from './decision-state-read-model.js';
import { ProjectionBackedMissionSnapshotAdapter } from './projection-backed-mission-snapshot-adapter.js';

class FakeIdentityMap implements MissionIdentityMap {
  private readonly map = new Map<string, MissionIdentity>();
  set(chatId: string, missionId: string | null): void {
    this.map.set(chatId, { ...emptyIdentity(chatId), missionId });
  }
  load(chatId: string): Promise<MissionIdentity | null> {
    return Promise.resolve(this.map.get(chatId) ?? null);
  }
  save(identity: MissionIdentity): Promise<void> {
    this.map.set(identity.chatId, identity);
    return Promise.resolve();
  }
}

describe('ProjectionBackedMissionSnapshotAdapter (RFC-0035-G)', () => {
  it('conversa desconhecida (sem identidade) ⇒ null', async () => {
    const adapter = new ProjectionBackedMissionSnapshotAdapter(new InMemoryDecisionStateStore(), new FakeIdentityMap());
    expect(await adapter.load('chat-x')).toBeNull();
  });

  it('identidade sem missionId (missão não nasceu) ⇒ null', async () => {
    const ids = new FakeIdentityMap();
    ids.set('chat-1', null);
    const adapter = new ProjectionBackedMissionSnapshotAdapter(new InMemoryDecisionStateStore(), ids);
    expect(await adapter.load('chat-1')).toBeNull();
  });

  it('GO-LIVE 9B: identidade SEM registro projetado ⇒ default com caseExists=true (o CASO é fato de domínio, não da projeção)', async () => {
    const ids = new FakeIdentityMap();
    ids.set('chat-1', 'M1');
    const adapter = new ProjectionBackedMissionSnapshotAdapter(new InMemoryDecisionStateStore(), ids);
    const snap = await adapter.load('chat-1');
    expect(snap).not.toBeNull();
    expect(snap?.caseExists).toBe(true); // missão existe (identidade) ⇒ caso existe
    expect(snap?.truthEstablished).toBe(false); // demais campos no default (projeção atrasada)
    expect(snap?.stateCode).toBe('ABERTA');
  });

  it('resolve chatId→missionId e reflete truthEstablished; demais campos no default', async () => {
    const ids = new FakeIdentityMap();
    ids.set('chat-1', 'M1');
    const store = new InMemoryDecisionStateStore();
    await store.save({ missionId: 'M1', truthEstablished: true, updatedAt: new Date('2026-07-16T00:00:00.000Z') });
    const snap = await new ProjectionBackedMissionSnapshotAdapter(store, ids).load('chat-1');
    expect(snap?.truthEstablished).toBe(true);
    expect(snap?.missionId).toBe('M1');
    // Campos SEM produtor permanecem no default de emptySnapshot (RFC-0035-H).
    expect(snap?.stageCode).toBe('ONBOARDING');
    expect(snap?.stateCode).toBe('ABERTA');
    expect(snap?.matterRequiresHuman).toBe(false);
    expect(snap?.canonSilent).toBe(false);
    expect(snap?.deadlines).toEqual([]);
    expect(snap?.pendingDocuments).toEqual([]);
    expect(snap?.awaitingDocuments).toBe(false);
  });

  it('B4.1 — terminalState=ENCERRADA ⇒ stateCode ENCERRADA no snapshot (ativa RO-STOP-CONCLUDED)', async () => {
    const ids = new FakeIdentityMap();
    ids.set('chat-1', 'M1');
    const store = new InMemoryDecisionStateStore();
    await store.save({ missionId: 'M1', truthEstablished: true, terminalState: 'ENCERRADA', updatedAt: new Date('2026-07-16T00:00:00.000Z') });
    const snap = await new ProjectionBackedMissionSnapshotAdapter(store, ids).load('chat-1');
    expect(snap?.stateCode).toBe('ENCERRADA');
    expect(snap?.truthEstablished).toBe(true);
  });
});
