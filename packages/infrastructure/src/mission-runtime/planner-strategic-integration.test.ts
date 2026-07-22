// ─────────────────────────────────────────────────────────────────────────────
// GO-LIVE 10C — PLANNER INTEGRATION. Prova o fluxo final:
//   Truth Layer → Strategic Reasoning → Executive Mind → StrategicDecision →
//   Planner (EXECUTA). O Planner não compara nem escolhe estratégias: recebe UMA
//   StrategicDecision e executa, carimbando a ORIGEM na auditoria da missão.
// Testes: 1 decisão ⇒ 1 missão; missão referencia o decisionId; o Planner não
// compara (mesmas intenções ⇒ mesmas missões, só muda a origem); fluxo legado
// intacto quando não há Executive Mind.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type {
  BrainContext,
  BrainFacts,
  MissionFacts,
  PerceptView,
  StrategicDecision,
} from '@reconstrua/application';
import {
  ExecutiveBrainRuntime,
  emptySnapshot,
  raciocinar,
  deliberar,
  ESTRATEGIAS_CONSIGNADO_INSS,
} from '@reconstrua/application';
import { InMemoryEventStore } from '../event-store/in-memory-event-store.js';
import { CryptoHasher } from '../event-store/crypto-hasher.js';
import { assembleMissionRuntime } from './build-mission-runtime.js';
import { MISSION_RULE_CATALOG } from './mission-rule-catalog.js';
import { toMissionUseCaseIntents } from './mission-brain-intents.js';

const NOW = new Date('2026-07-19T00:00:00.000Z');
const CHAT = '5511988887777@s.whatsapp.net';

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
    text: 'olá, preciso de ajuda com meu consignado',
    mediaRef: null,
    fileName: null,
    mimeType: null,
    occurredAt: NOW,
  };
}
function brainContext(): BrainContext {
  const percept: PerceptView = {
    kind: 'text',
    sentiment: 'neutral',
    urgency: 'normal',
    hasArtifacts: false,
    artifactCount: 0,
    silenceMs: null,
    purpose: 'service_request',
  };
  return {
    percept,
    snapshot: emptySnapshot(CHAT),
    memory: { turnCount: 1, lastOutboundAgoMs: null },
    rules: MISSION_RULE_CATALOG,
    chatId: CHAT,
    now: NOW,
  };
}

/** O cliente do decreto 10A → decisão do Executive Mind (revisão contratual, ALTA). */
function decisaoDoDecreto(): StrategicDecision {
  const fatos: BrainFacts = {
    beneficio: 'aposentadoria',
    documentacao_mencionada: 'hiscon',
    problema_principal: 'descontos_nao_reconhecidos',
    tempo_do_problema: 'mais_de_2_anos',
    multiplos_bancos: 'true',
  };
  const d = deliberar(raciocinar(fatos, ESTRATEGIAS_CONSIGNADO_INSS));
  if (d === null) throw new Error('esperava uma StrategicDecision');
  return d;
}

function harness() {
  const clock = new TestClock();
  const eventStore = new InMemoryEventStore(new CryptoHasher(), new SeqUuid(), clock);
  const brain = new ExecutiveBrainRuntime({ clock, uuid: new SeqUuid() });
  const { runtime } = assembleMissionRuntime({
    eventStore,
    hasher: new CryptoHasher(),
    uuid: new SeqUuid(),
    clock,
  });
  return { eventStore, brain, runtime };
}

describe('GO-LIVE 10C · uma StrategicDecision gera exatamente UMA Mission rastreável', () => {
  it('a missão nasce e sua proveniência referencia decisionId, strategyRef e confidence', async () => {
    const { eventStore, brain, runtime } = harness();
    const decision = decisaoDoDecreto();

    const outcome = await brain.decide(brainContext());
    // O Planner recebe a decisão JÁ tomada e apenas carimba+executa.
    const missionIntents = toMissionUseCaseIntents(outcome.intents, decision);
    expect(missionIntents).toHaveLength(1);
    expect(missionIntents[0]?.strategicDecision?.decisionId).toBe(decision.decisionId);

    const result = await runtime.execute(facts('text'), missionIntents);
    expect(result.ok).toBe(true);
    expect(result.identity.missionId).not.toBeNull();

    const missionEvents = await eventStore.readStream(
      'mission',
      result.identity.missionId as string,
      0,
    );
    expect(missionEvents).toHaveLength(1); // exatamente UMA missão
    const fundamento = missionEvents[0]?.provenance.fundamento ?? '';
    // Rastreável até a estratégia (e, por ela, até os fatos que a originaram):
    expect(fundamento).toContain(decision.decisionId);
    expect(fundamento).toContain('strategyRef=EST-CONSIG-REVISAO-001');
    expect(fundamento).toContain('confiança=alta');
  });
});

describe('GO-LIVE 10C · o Planner EXECUTA, jamais compara/escolhe estratégias', () => {
  it('mesmas intenções + decisões DIFERENTES ⇒ mesmas missões (só muda a origem carimbada)', async () => {
    const { brain } = harness();
    const outcome = await brain.decide(brainContext());

    const revisao = decisaoDoDecreto();
    const fraude = deliberar(
      raciocinar({ problema_principal: 'emprestimo_nao_contratado' }, ESTRATEGIAS_CONSIGNADO_INSS),
    );

    const comRevisao = toMissionUseCaseIntents(outcome.intents, revisao);
    const comFraude = toMissionUseCaseIntents(outcome.intents, fraude);

    // O Planner não escolhe: os USE CASES executados são idênticos; a decisão só
    // muda a proveniência (origem), nunca QUAIS missões nascem nem quantas.
    expect(comRevisao.map((i) => i.useCase)).toEqual(comFraude.map((i) => i.useCase));
    expect(comRevisao).toHaveLength(1);
    expect(comRevisao[0]?.strategicDecision?.strategyRef).toBe('EST-CONSIG-REVISAO-001');
    expect(comFraude[0]?.strategicDecision?.strategyRef).toBe('EST-CONSIG-NAO-CONTRATADO-001');
  });
});

describe('GO-LIVE 10C · compatibilidade — sem Executive Mind, o fluxo LEGADO continua', () => {
  it('sem StrategicDecision: a missão nasce igual e a proveniência NÃO cita estratégia', async () => {
    const { eventStore, brain, runtime } = harness();
    const outcome = await brain.decide(brainContext());

    const missionIntents = toMissionUseCaseIntents(outcome.intents); // fluxo legado (sem decisão)
    expect(missionIntents[0]?.strategicDecision).toBeUndefined();

    const result = await runtime.execute(facts('text'), missionIntents);
    expect(result.ok).toBe(true);
    expect(result.identity.missionId).not.toBeNull();

    const missionEvents = await eventStore.readStream(
      'mission',
      result.identity.missionId as string,
      0,
    );
    expect(missionEvents).toHaveLength(1);
    expect(missionEvents[0]?.provenance.fundamento ?? '').not.toContain('StrategicDecision');
  });

  it('decision=null é tratado como legado (idêntico a omitir o argumento)', async () => {
    const { brain } = harness();
    const outcome = await brain.decide(brainContext());
    const comNull = toMissionUseCaseIntents(outcome.intents, null);
    expect(comNull[0]?.strategicDecision).toBeUndefined();
  });
});
