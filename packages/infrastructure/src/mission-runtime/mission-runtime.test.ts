// ─────────────────────────────────────────────────────────────────────────────
// Testes do Mission Runtime — os três fluxos obrigatórios, R1–R9, proveniência
// (DECISOR/TIPO/FUNDAMENTO/REGRA), idempotência, "nenhuma decisão sem regra",
// persistência EXCLUSIVA via Event Store e integridade (R9).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { MissionFacts, MissionUseCaseIntent, StoredEvent } from '@reconstrua/application';
import { InMemoryEventStore } from '../event-store/in-memory-event-store.js';
import { CryptoHasher } from '../event-store/crypto-hasher.js';
import { assembleMissionRuntime } from './build-mission-runtime.js';
import { InMemoryMissionIdentityMap, InMemoryMissionAuditSink } from './in-memory-adapters.js';

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

function intent(useCase: string, over: Partial<MissionUseCaseIntent> = {}): MissionUseCaseIntent {
  return {
    useCase,
    references: [],
    decisor: 'AHRI',
    tipo: 'DECISAO_OPERACIONAL_AUTOMATIZADA',
    fundamento: 'Regra Constitucional + RO-2D',
    operationalRuleRef: 'RO-2D-TEST',
    ...over,
  };
}

function facts(perceptKind: string, over: Partial<MissionFacts> = {}): MissionFacts {
  return {
    chatId: CHAT,
    senderId: CHAT,
    messageId: 'M1',
    perceptKind,
    text: null,
    mediaRef: null,
    fileName: null,
    mimeType: null,
    occurredAt: NOW,
    ...over,
  };
}

function harness() {
  const clock = new TestClock();
  const eventStore = new InMemoryEventStore(new CryptoHasher(), new SeqUuid(), clock);
  const hasher = new CryptoHasher();
  const identityMap = new InMemoryMissionIdentityMap();
  const auditSink = new InMemoryMissionAuditSink();
  const { runtime, auditor } = assembleMissionRuntime({
    eventStore,
    hasher,
    uuid: new SeqUuid(),
    clock,
    identityMap,
    auditSink,
  });
  return { runtime, eventStore, auditSink, auditor, identityMap };
}

async function stream(eventStore: InMemoryEventStore, type: string, id: string | null): Promise<readonly StoredEvent[]> {
  return id === null ? [] : eventStore.readStream(type, id, 0);
}

describe('Mission Runtime — Fluxo 1: "Olá" → onboarding completo', () => {
  it('reconhece Pessoa, Cliente, cria Missão e deriva Verdade→Estado→Etapa', async () => {
    const h = harness();
    const result = await h.runtime.execute(facts('text'), [intent('OnboardClient')]);

    expect(result.ok).toBe(true);
    const kinds = result.outcomes.map((o) => o.useCase);
    expect(kinds).toEqual(['RecognizePerson', 'RecognizeCliente', 'CreateMission', 'BuildTruth', 'DeriveState', 'RepresentStage']);

    const id = result.identity;
    expect(id.personId).not.toBeNull();
    expect(id.clienteId).not.toBeNull();
    expect(id.missionId).not.toBeNull();
    expect(id.latestTruthId).not.toBeNull();
    expect(id.latestStateId).not.toBeNull();
    expect(id.latestStageId).not.toBeNull();

    // Persistiu no Event Store (um evento por stream criado).
    expect((await stream(h.eventStore, 'person', id.personId)).length).toBe(1);
    expect((await stream(h.eventStore, 'mission', id.missionId)).length).toBe(1);
    expect((await stream(h.eventStore, 'operational-state', id.latestStateId)).length).toBe(1);
  });

  it('carimba PROVENIÊNCIA (DECISOR/FUNDAMENTO/REGRA) e Fato nos eventos relevantes', async () => {
    const h = harness();
    const result = await h.runtime.execute(facts('text'), [intent('OnboardClient')]);
    const events = await stream(h.eventStore, 'mission', result.identity.missionId);
    const created = events[0];
    expect(created?.provenance.actor).toBe('AHRI');
    expect(created?.provenance.operationalRuleRef).toBe('RO-2D-TEST');
    expect(created?.provenance.fundamento).not.toBeNull();
    expect(created?.isRelevant).toBe(true);
    expect(created?.provenance.factRef).not.toBeNull(); // Evento Relevante fundado (E12-L09)
  });

  it('registra a execução na auditoria (rastreável)', async () => {
    const h = harness();
    await h.runtime.execute(facts('text'), [intent('OnboardClient')]);
    const records = h.auditSink.all();
    expect(records).toHaveLength(1);
    expect(records[0]?.ok).toBe(true);
    expect(records[0]?.outcomes.length).toBe(6);
  });
});

describe('Mission Runtime — Fluxo 2/3: documento → conhecimento → Verdade/Estado/Etapa', () => {
  it('ingesta documento após onboarding (R3→R4→R5→R6) e re-sintetiza a Verdade', async () => {
    const h = harness();
    await h.runtime.execute(facts('text'), [intent('OnboardClient')]);
    const result = await h.runtime.execute(facts('pdf', { fileName: 'rg.pdf', messageId: 'M2' }), [intent('IngestDocument')]);

    expect(result.ok).toBe(true);
    const kinds = result.outcomes.map((o) => o.useCase);
    expect(kinds).toEqual(['RecognizeDocument', 'RecognizeEvent', 'BuildKnowledge', 'BuildTruth', 'DeriveState', 'RepresentStage']);

    const id = result.identity;
    expect(id.lastDocumentId).not.toBeNull();
    expect(id.lastEventId).not.toBeNull();
    expect(id.caseId).not.toBeNull();
    expect(id.processId).not.toBeNull();
    expect((await stream(h.eventStore, 'document', id.lastDocumentId)).length).toBe(1);
    expect((await stream(h.eventStore, 'event', id.lastEventId)).length).toBe(1);
    expect((await stream(h.eventStore, 'case', id.caseId)).length).toBe(1);
  });

  it('Fluxo 3: novo documento re-sintetiza Verdade/Estado/Etapa e o Conhecimento base é idempotente', async () => {
    const h = harness();
    await h.runtime.execute(facts('text'), [intent('OnboardClient')]);
    await h.runtime.execute(facts('pdf', { fileName: 'a.pdf', messageId: 'M2' }), [intent('IngestDocument')]);
    const result = await h.runtime.execute(facts('pdf', { fileName: 'b.pdf', messageId: 'M3' }), [intent('IngestDocument')]);

    const knowledge = result.outcomes.find((o) => o.useCase === 'BuildKnowledge');
    expect(knowledge?.skipped).toBe(true); // Caso/Processo já existem
    const truth = result.outcomes.find((o) => o.useCase === 'BuildTruth');
    expect(truth?.ok).toBe(true);
    expect(truth?.skipped).toBe(false); // Verdade re-sintetizada
  });
});

describe('Mission Runtime — idempotência, regra obrigatória, integridade', () => {
  it('onboarding repetido não duplica a Missão (idempotente)', async () => {
    const h = harness();
    const first = await h.runtime.execute(facts('text'), [intent('OnboardClient')]);
    const second = await h.runtime.execute(facts('text'), [intent('OnboardClient')]);

    const person = second.outcomes.find((o) => o.useCase === 'RecognizePerson');
    expect(person?.skipped).toBe(true);
    // A Missão continua com exatamente um evento (não recriada).
    expect((await stream(h.eventStore, 'mission', first.identity.missionId)).length).toBe(1);
  });

  it('NENHUMA decisão sem regra: intenção sem operationalRuleRef é recusada', async () => {
    const h = harness();
    const result = await h.runtime.execute(facts('text'), [intent('OnboardClient', { operationalRuleRef: '' })]);
    expect(result.ok).toBe(false);
    expect(result.outcomes[0]?.error).toContain('Regra Operacional');
  });

  it('intenção de Use Case desconhecida é recusada (não inventa comportamento)', async () => {
    const h = harness();
    const result = await h.runtime.execute(facts('text'), [intent('FabricarVerdade')]);
    expect(result.ok).toBe(false);
    expect(result.outcomes[0]?.error).toContain('não registrado');
  });

  it('R9 — auditoria integral confirma a cadeia íntegra após o onboarding', async () => {
    const h = harness();
    const onboarded = await h.runtime.execute(facts('text'), [intent('OnboardClient')]);
    const report = await h.auditor.verify(onboarded.identity);
    expect(report.ok).toBe(true);
    expect(report.streamsChecked).toBeGreaterThanOrEqual(4);
  });
});
