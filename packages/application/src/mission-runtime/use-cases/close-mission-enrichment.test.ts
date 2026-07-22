// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN EVENT ENRICHMENT (GO-LIVE 12A) — o evento de encerramento (CloseMission)
// passa a carregar os dados JÁ existentes na missão e na sua proveniência (10C):
// missionId, decisionId, strategyRef, confidence, correlationId, cliente,
// advogado. Propagados, nunca recalculados. Prova o payload enriquecido.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type {
  AppendResult,
  StreamId,
  StreamType,
  ExpectedVersion,
} from '../../event-store/index.js';
import type { UncommittedEvent } from '../../event-store/index.js';
import type { EventAppender } from '../ports.js';
import { emptyIdentity, type MissionFacts, type MissionUseCaseIntent } from '../types.js';
import type { MissionContext } from '../use-case.js';
import { CloseMissionUseCase } from './close-mission.js';

const NOW = new Date('2026-07-19T00:00:00.000Z');
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

/** Captura os payloads dos eventos anexados (sem tocar o event store real). */
class CaptureAppender implements EventAppender {
  public payloads: ReadonlyArray<Record<string, unknown>>[] = [];
  append(
    _st: StreamType,
    _sid: StreamId,
    _ev: ExpectedVersion,
    events: readonly UncommittedEvent[],
  ): Promise<AppendResult> {
    this.payloads.push(events.map((e) => e.payload as Record<string, unknown>));
    return Promise.resolve({ events: [], version: 1 });
  }
}

function intent(over: Partial<MissionUseCaseIntent> = {}): MissionUseCaseIntent {
  return {
    useCase: 'CloseMission',
    references: [],
    decisor: 'AHRI',
    tipo: 'Decisão Operacional Automatizada',
    fundamento: 'encerramento',
    operationalRuleRef: 'RO-STOP-CONCLUDED-001',
    ...over,
  };
}

const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const TRUTH_UUID = '00000000-0000-4000-8000-0000000000b2';

function ctx(intentIn: MissionUseCaseIntent): MissionContext {
  const facts: MissionFacts = {
    chatId: '5511999@c',
    senderId: '5511999@c',
    messageId: 'corr-turn-99',
    perceptKind: 'text',
    text: 'pode encerrar',
    mediaRef: null,
    fileName: null,
    mimeType: null,
    occurredAt: NOW,
  };
  const identity = {
    ...emptyIdentity('5511999@c'),
    missionId: MISSION_UUID,
    clienteId: 'CLI-1',
    latestTruthId: TRUTH_UUID,
  };
  return { intent: intentIn, facts, identity, now: NOW };
}

function run() {
  const appender = new CaptureAppender();
  const uc = new CloseMissionUseCase({
    appender,
    uuid: new SeqUuid(),
    clock: new TestClock(),
    config: { ahriResponsibleId: 'dra. ana' },
  });
  return { appender, uc };
}

describe('12A · o evento de encerramento é enriquecido na ORIGEM', () => {
  it('com decisão estratégica (10C): carrega decisionId/strategyRef/confidence + identidade', async () => {
    const { appender, uc } = run();
    const outcome = await uc.execute(
      ctx(
        intent({
          strategicDecision: {
            decisionId: 'dec-abc12345',
            strategyRef: 'EST-CONSIG-REVISAO-001',
            confidence: 'alta',
            decisionReason: 'venceu',
          },
        }),
      ),
    );
    expect(outcome.ok).toBe(true);

    const payload = appender.payloads[0]?.[0];
    expect(payload).toMatchObject({
      missionId: MISSION_UUID,
      terminalState: 'ENCERRADA',
      correlationId: 'corr-turn-99', // do facts (turno)
      cliente: 'CLI-1', // da identidade
      advogado: 'dra. ana', // da config
      decisionId: 'dec-abc12345',
      strategyRef: 'EST-CONSIG-REVISAO-001',
      confidence: 'alta',
    });
  });

  it('sem decisão estratégica: não fabrica campos (só o que existe)', async () => {
    const { appender, uc } = run();
    await uc.execute(ctx(intent())); // intent sem strategicDecision
    const payload = appender.payloads[0]?.[0] ?? {};
    expect(payload).toMatchObject({
      missionId: MISSION_UUID,
      terminalState: 'ENCERRADA',
      cliente: 'CLI-1',
      correlationId: 'corr-turn-99',
    });
    expect(payload['decisionId']).toBeUndefined();
    expect(payload['strategyRef']).toBeUndefined();
  });

  it('não altera a lógica: continua exigindo Missão e Verdade de origem', async () => {
    const appender = new CaptureAppender();
    const uc = new CloseMissionUseCase({
      appender,
      uuid: new SeqUuid(),
      clock: new TestClock(),
      config: { ahriResponsibleId: 'x' },
    });
    const semTruth: MissionContext = {
      ...ctx(intent()),
      identity: { ...emptyIdentity('c'), missionId: MISSION_UUID, latestTruthId: null },
    };
    const outcome = await uc.execute(semTruth);
    expect(outcome.ok).toBe(false);
    expect(appender.payloads).toHaveLength(0);
  });
});
