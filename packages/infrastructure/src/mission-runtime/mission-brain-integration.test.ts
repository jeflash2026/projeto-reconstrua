// ─────────────────────────────────────────────────────────────────────────────
// Integração 2C→2D — o FLUXO OBRIGATÓRIO: percepção → Executive Brain (decide) →
// Mission Runtime (executa) → Event Store. Prova que a AHRI passa a EXECUTAR o
// trabalho a partir das intenções do Brain, e que ainda produz a resposta ao cliente.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { BrainContext, BrainMemoryView, MissionFacts, PerceptView } from '@reconstrua/application';
import { ExecutiveBrainRuntime, emptySnapshot } from '@reconstrua/application';
import { InMemoryEventStore } from '../event-store/in-memory-event-store.js';
import { CryptoHasher } from '../event-store/crypto-hasher.js';
import { assembleMissionRuntime } from './build-mission-runtime.js';
import { MISSION_RULE_CATALOG } from './mission-rule-catalog.js';
import { toMissionUseCaseIntents } from './mission-brain-intents.js';

const NOW = new Date('2026-07-14T00:00:00.000Z');
const CHAT = '5511999999999@s.whatsapp.net';

class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

function facts(perceptKind: string): MissionFacts {
  return {
    chatId: CHAT,
    senderId: CHAT,
    messageId: 'M1',
    perceptKind,
    text: 'olá',
    mediaRef: null,
    fileName: null,
    mimeType: null,
    occurredAt: NOW,
  };
}

function brainContext(kind: string, turnCount: number, purpose = 'service_request', caseExists = false): BrainContext {
  // GO-LIVE 9C: onboarding só nasce de PEDIDO percebido (service_request) ou documento.
  const percept: PerceptView = { kind, sentiment: 'neutral', urgency: 'normal', hasArtifacts: kind !== 'text', artifactCount: kind !== 'text' ? 1 : 0, silenceMs: null, purpose };
  const memory: BrainMemoryView = { turnCount, lastOutboundAgoMs: null };
  return { percept, snapshot: { ...emptySnapshot(CHAT), ...(caseExists ? { caseExists: true } : {}) }, memory, rules: MISSION_RULE_CATALOG, chatId: CHAT, now: NOW };
}

describe('Fluxo obrigatório: Percepção → Brain → Mission Runtime → Event Store', () => {
  it('PEDIDO percebido (service_request) → onboarding + resposta; o Mission Runtime cria a Missão (GO-LIVE 9C)', async () => {
    const clock = new TestClock();
    const eventStore = new InMemoryEventStore(new CryptoHasher(), new SeqUuid(), clock);
    const brain = new ExecutiveBrainRuntime({ clock, uuid: new SeqUuid() });
    const { runtime } = assembleMissionRuntime({ eventStore, hasher: new CryptoHasher(), uuid: new SeqUuid(), clock });

    // 1) Brain DECIDE (determinístico, sem LLM).
    const outcome = await brain.decide(brainContext('text', 1));
    const useCaseKinds = outcome.intents.filter((i) => i.kind === 'use_case');
    const conversationKinds = outcome.intents.filter((i) => i.kind === 'conversation');
    expect(useCaseKinds).toHaveLength(1); // OnboardClient
    expect(conversationKinds.length).toBeGreaterThanOrEqual(1); // resposta ao cliente

    // 2) Mission Runtime EXECUTA as intenções de Use Case do Brain.
    const missionIntents = toMissionUseCaseIntents(outcome.intents);
    expect(missionIntents[0]?.useCase).toBe('OnboardClient');
    expect(missionIntents[0]?.operationalRuleRef).toMatch(/^RO-/);

    const result = await runtime.execute(facts('text'), missionIntents);

    // 3) Trabalho executado e persistido: a Missão nasceu.
    expect(result.ok).toBe(true);
    expect(result.identity.missionId).not.toBeNull();
    const missionEvents = await eventStore.readStream('mission', result.identity.missionId as string, 0);
    expect(missionEvents).toHaveLength(1);
    expect(missionEvents[0]?.provenance.actor).toBe('AHRI');
  });

  it('documento percebido → o Brain decide IngestDocument (após onboarding)', async () => {
    const clock = new TestClock();
    const eventStore = new InMemoryEventStore(new CryptoHasher(), new SeqUuid(), clock);
    const brain = new ExecutiveBrainRuntime({ clock, uuid: new SeqUuid() });
    const { runtime } = assembleMissionRuntime({ eventStore, hasher: new CryptoHasher(), uuid: new SeqUuid(), clock });

    // onboarding primeiro
    const onboard = await brain.decide(brainContext('text', 1));
    await runtime.execute(facts('text'), toMissionUseCaseIntents(onboard.intents));

    // documento (onboarding JÁ existe no domínio → caseExists=true; ONBOARD-DOC não re-dispara)
    const docOutcome = await brain.decide(brainContext('pdf', 2, 'unknown', true));
    const docIntents = toMissionUseCaseIntents(docOutcome.intents);
    expect(docIntents.some((i) => i.useCase === 'IngestDocument')).toBe(true);

    const result = await runtime.execute(
      { ...facts('pdf'), fileName: 'rg.pdf', messageId: 'M2' },
      docIntents,
    );
    expect(result.ok).toBe(true);
    expect(result.identity.lastDocumentId).not.toBeNull();
  });
});
