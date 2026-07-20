// ─────────────────────────────────────────────────────────────────────────────
// Regressão GO-LIVE — o PRIMEIRO HISCON de um cliente novo: quando OnboardClient
// (prioridade 58) e IngestDocument (70) saem no MESMO turno, a ordem por
// prioridade executava R3 antes da missão existir (INV-D08) e o documento perdia
// a vez. OnboardClient roda SEMPRE primeiro; o restante preserva a ordem.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import type { BrainIntent, MissionIdentity, MissionIdentityMap } from '@reconstrua/application';
import { toMissionUseCaseIntents } from './mission-brain-intents.js';
import { assembleMissionRuntime } from './build-mission-runtime.js';
import { InMemoryEventStore } from '../event-store/in-memory-event-store.js';

const CHAT = '5517996332346@s.whatsapp.net';
const NOW = new Date('2026-07-20T16:32:58.000Z');

function useCaseIntent(useCase: string, ref: string): BrainIntent {
  return {
    kind: 'use_case',
    id: randomUUID(),
    chatId: CHAT,
    useCase,
    references: [],
    provenance: { decisor: 'AHRI', tipo: 'Decisão Operacional Automatizada', fundamento: 'F', operationalRuleRef: ref },
    formedAt: NOW,
  } as unknown as BrainIntent;
}

describe('toMissionUseCaseIntents — OnboardClient sempre primeiro (INV-D08)', () => {
  it('reordena [IngestDocument, OnboardClient] → [OnboardClient, IngestDocument]', () => {
    const out = toMissionUseCaseIntents([
      useCaseIntent('IngestDocument', 'RO-2D-INGEST-DOC'),
      useCaseIntent('OnboardClient', 'RO-2D-ONBOARD-DOC'),
    ]);
    expect(out.map((i) => i.useCase)).toEqual(['OnboardClient', 'IngestDocument']);
  });

  it('sem OnboardClient ⇒ ordem original preservada (sort estável)', () => {
    const out = toMissionUseCaseIntents([
      useCaseIntent('IngestDocument', 'RO-A'),
      useCaseIntent('ExecuteOperation', 'RO-B'),
    ]);
    expect(out.map((i) => i.useCase)).toEqual(['IngestDocument', 'ExecuteOperation']);
  });
});

describe('e2e — o PRIMEIRO documento de um cliente novo cria a missão E é ingerido no MESMO turno', () => {
  it('missão nasce e o documento entra (nada perde a vez)', async () => {
    const clock = { now: () => NOW };
    const uuid = { next: () => randomUUID() } as never;
    const hasher = { hash: (s: string) => createHash('sha256').update(s).digest('hex') };
    const eventStore = new InMemoryEventStore(hasher, uuid, clock);
    let state: MissionIdentity | null = null;
    const identityMap: MissionIdentityMap = {
      load: () => Promise.resolve(state),
      save: (i) => { state = i; return Promise.resolve(); },
    };
    const { runtime } = assembleMissionRuntime({ eventStore, hasher, uuid, clock, identityMap });

    const facts = {
      chatId: CHAT, senderId: CHAT, messageId: '3AE87DBE4E5850C0775E', perceptKind: 'pdf',
      text: null, mediaRef: 'https://mmg.whatsapp.net/x',
      fileName: 'extrato_emprestimo_consignado_completo_030726.pdf',
      mimeType: 'application/pdf', occurredAt: NOW,
    } as never;
    // A ordem CRUA do Brain (prioridade): IngestDocument antes de OnboardClient.
    const intents = toMissionUseCaseIntents([
      useCaseIntent('IngestDocument', 'RO-2D-INGEST-DOC'),
      useCaseIntent('OnboardClient', 'RO-2D-ONBOARD-DOC'),
    ]);
    const r = await runtime.execute(facts, intents);

    const porUseCase = new Map(r.outcomes.map((o) => [o.useCase, o]));
    expect(porUseCase.get('CreateMission')?.ok).toBe(true);
    expect(porUseCase.get('RecognizeDocument')?.ok).toBe(true); // o HISCON entrou
    const final = await identityMap.load(CHAT);
    expect(final?.missionId).toBeTruthy();
    expect(final?.lastDocumentId).toBeTruthy();
  });
});
