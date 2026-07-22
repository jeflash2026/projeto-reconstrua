// ─────────────────────────────────────────────────────────────────────────────
// AUTONOMOUS EXECUTION PIPELINE (GO-LIVE 10D) — prova de UM turno completo:
//   entrada → Truth → Strategic Reasoning → Executive Mind → Planner →
//   Mission Runtime → Conversation → Resposta
// tudo derivado por processTurn(), sem chamadas manuais entre as etapas. A
// auditoria reconstrói o turno (tempo/resultado por etapa + decisionId +
// missionId + correlationId). Fluxo legado (sem decisão) continua produzindo.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type {
  BrainIntent,
  BrainMemoryView,
  ConversationContextView,
  MissionFacts,
  MissionSnapshot,
  MissionSnapshotPort,
  PerceptView,
} from '@reconstrua/application';
import {
  CATALOGO_CONSIGNADO_INSS,
  ESTRATEGIAS_CONSIGNADO_INSS,
  ExecutiveBrainRuntime,
  emptySnapshot,
} from '@reconstrua/application';
import { InMemoryEventStore } from '../event-store/in-memory-event-store.js';
import { CryptoHasher } from '../event-store/crypto-hasher.js';
import { assembleMissionRuntime } from '../mission-runtime/build-mission-runtime.js';
import { MISSION_RULE_CATALOG } from '../mission-runtime/mission-rule-catalog.js';
import {
  AutonomousTurnPipeline,
  type TurnConversationPort,
  type TurnInput,
} from './process-turn.js';

const NOW = new Date('2026-07-19T00:00:00.000Z');
const CHAT = '5511977776666@s.whatsapp.net';

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

/** Truth Layer simulada: devolve o snapshot que lhe entregarem (ou vazio). */
class FakeTruth implements MissionSnapshotPort {
  constructor(private readonly snap: MissionSnapshot | null) {}
  load(): Promise<MissionSnapshot | null> {
    return Promise.resolve(this.snap);
  }
}

/** Regras de produção do Mission Runtime (as mesmas do Brain de missão). */
const RULES = { all: () => Promise.resolve(MISSION_RULE_CATALOG) };

/** Conversa simulada: registra o que recebeu e devolve UMA resposta acolhedora.
 *  NÃO reimplementa a Conversa real — é o port estreito do pipeline. */
class FakeConversation implements TurnConversationPort {
  public recebido: readonly BrainIntent[] = [];
  respond(
    intents: readonly BrainIntent[],
    _context: ConversationContextView,
  ): Promise<readonly string[]> {
    this.recebido = intents;
    const fala = intents.filter((i) => i.kind === 'conversation');
    return Promise.resolve(
      fala.length > 0 ? ['Olá! Estou aqui para ajudar com seu consignado.'] : [],
    );
  }
}

function percept(kind = 'text'): PerceptView {
  return {
    kind,
    sentiment: 'neutral',
    urgency: 'normal',
    hasArtifacts: kind !== 'text',
    artifactCount: kind !== 'text' ? 1 : 0,
    silenceMs: null,
    purpose: 'service_request',
  };
}
function missionFacts(): MissionFacts {
  return {
    chatId: CHAT,
    senderId: CHAT,
    messageId: 'M1',
    perceptKind: 'text',
    text: 'quero rever meu consignado',
    mediaRef: null,
    fileName: null,
    mimeType: null,
    occurredAt: NOW,
  };
}
function memory(): BrainMemoryView {
  return { turnCount: 1, lastOutboundAgoMs: null };
}

/** Contexto com o diálogo consignado já aprendido (9G) — alimenta Strategic Facts. */
function contextoComConhecimento(): ConversationContextView {
  const entries = [
    {
      id: 'e1',
      chatId: CHAT,
      kind: 'outbound' as const,
      at: new Date(2026, 6, 18, 12, 1),
      text: 'O que aconteceu com seu empréstimo consignado?',
      intentDirective: null,
      operationalRuleRef: null,
      meta: {},
    },
    {
      id: 'e2',
      chatId: CHAT,
      kind: 'inbound' as const,
      at: new Date(2026, 6, 18, 12, 2),
      text: 'Descontam parcelas que eu não reconheço, há mais de dois anos.',
      intentDirective: null,
      operationalRuleRef: null,
      meta: {},
    },
    {
      id: 'e3',
      chatId: CHAT,
      kind: 'outbound' as const,
      at: new Date(2026, 6, 18, 12, 3),
      text: 'Você recebe aposentadoria ou pensão?',
      intentDirective: null,
      operationalRuleRef: null,
      meta: {},
    },
    {
      id: 'e4',
      chatId: CHAT,
      kind: 'inbound' as const,
      at: new Date(2026, 6, 18, 12, 4),
      text: 'Aposentadoria. Tenho o hiscon e contratos em mais de um banco.',
      intentDirective: null,
      operationalRuleRef: null,
      meta: {},
    },
  ];
  return {
    chatId: CHAT,
    session: { chatId: CHAT, turns: 4, lastInboundAt: null, lastOutboundAt: null },
    recentEntries: entries,
    recentOutboundTexts: entries.filter((e) => e.kind === 'outbound').map((e) => e.text ?? ''),
    lastPercept: {
      envelope: { text: 'quero rever meu consignado' },
      enrichment: { perceivedPurpose: 'service_request', detectedIntentSignal: null },
    } as never,
    silenceMs: null,
  } as unknown as ConversationContextView;
}

function pipeline(snap: MissionSnapshot | null) {
  const clock = new TestClock();
  const eventStore = new InMemoryEventStore(new CryptoHasher(), new SeqUuid(), clock);
  const { runtime } = assembleMissionRuntime({
    eventStore,
    hasher: new CryptoHasher(),
    uuid: new SeqUuid(),
    clock,
  });
  const conversation = new FakeConversation();
  const p = new AutonomousTurnPipeline({
    truth: new FakeTruth(snap),
    rules: RULES,
    brain: new ExecutiveBrainRuntime({ clock, uuid: new SeqUuid() }),
    mission: runtime,
    conversation,
    strategyCatalog: ESTRATEGIAS_CONSIGNADO_INSS,
    knowledgeCatalog: CATALOGO_CONSIGNADO_INSS,
    clock,
  });
  return { p, eventStore, conversation };
}

function input(): TurnInput {
  return {
    correlationId: 'corr-turn-001',
    chatId: CHAT,
    percept: percept(),
    missionFacts: missionFacts(),
    memory: memory(),
    context: contextoComConhecimento(),
  };
}

describe('GO-LIVE 10D · um turno completo, derivado automaticamente por processTurn()', () => {
  it('percorre TODAS as etapas na ordem oficial, sem chamadas manuais entre elas', async () => {
    // Snapshot vazio: onboarding pode nascer; o Conversation Knowledge (9G) é
    // quem sustenta a estratégia de revisão nos Strategic Facts.
    const { p } = pipeline(emptySnapshot(CHAT));
    const out = await p.processTurn(input());

    const ordem = out.steps.map((s) => s.step);
    expect(ordem).toEqual([
      'truth',
      'strategic-facts',
      'strategic-reasoning',
      'executive-mind',
      'planner',
      'mission-runtime',
      'conversation',
    ]);
    expect(out.steps.every((s) => s.ok)).toBe(true);
  });

  it('produz decisão, missão e resposta — tudo derivado no mesmo turno', async () => {
    const { p, eventStore } = pipeline(emptySnapshot(CHAT));
    const out = await p.processTurn(input());

    // Executive Mind decidiu a revisão contratual (fatos aprendidos na conversa).
    expect(out.strategicDecision?.strategyRef).toBe('EST-CONSIG-REVISAO-001');
    expect(out.decisionId).toMatch(/^dec-[0-9a-f]{8}$/);
    // Planner+Mission criaram a missão, carimbada com o decisionId (10C).
    expect(out.missionId).not.toBeNull();
    expect(out.response.length).toBeGreaterThanOrEqual(1);
    const ev = await eventStore.readStream('mission', out.missionId as string, 0);
    expect(ev[0]?.provenance.fundamento ?? '').toContain(out.decisionId as string);
  });

  it('AUDITORIA: cada etapa registra tempo e resultado; correlationId reconstrói o turno', async () => {
    const { p } = pipeline(emptySnapshot(CHAT));
    const out = await p.processTurn(input());

    expect(out.correlationId).toBe('corr-turn-001');
    for (const s of out.steps) {
      expect(s.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof s.ok).toBe('boolean');
    }
    // A trilha permite reconstruir do início ao fim: decisão + missão visíveis.
    expect(out.steps.find((s) => s.step === 'executive-mind')?.detail).toContain(
      'EST-CONSIG-REVISAO-001',
    );
    expect(out.steps.find((s) => s.step === 'mission-runtime')?.detail).toContain('mission');
  });
});

describe('GO-LIVE 10D · compatibilidade e garantias', () => {
  it('sem fatos que sustentem estratégia ⇒ decisão null, mas o turno ainda RESPONDE', async () => {
    // Truth vazia + sem conhecimento ⇒ nenhuma hipótese sustentada.
    const clock = new TestClock();
    const eventStore = new InMemoryEventStore(new CryptoHasher(), new SeqUuid(), clock);
    const { runtime } = assembleMissionRuntime({
      eventStore,
      hasher: new CryptoHasher(),
      uuid: new SeqUuid(),
      clock,
    });
    const p = new AutonomousTurnPipeline({
      truth: new FakeTruth(null),
      rules: RULES,
      brain: new ExecutiveBrainRuntime({ clock, uuid: new SeqUuid() }),
      mission: runtime,
      conversation: new FakeConversation(),
      strategyCatalog: ESTRATEGIAS_CONSIGNADO_INSS,
      knowledgeCatalog: CATALOGO_CONSIGNADO_INSS,
      clock,
    });
    const semConhecimento: ConversationContextView = {
      chatId: CHAT,
      session: { chatId: CHAT, turns: 1, lastInboundAt: null, lastOutboundAt: null },
      recentEntries: [],
      recentOutboundTexts: [],
      lastPercept: {
        envelope: { text: 'quero rever meu consignado' },
        enrichment: { perceivedPurpose: 'service_request', detectedIntentSignal: null },
      } as never,
      silenceMs: null,
    } as unknown as ConversationContextView;

    const out = await p.processTurn({ ...input(), context: semConhecimento });
    expect(out.strategicDecision).toBeNull(); // Executive Mind não inventa
    expect(out.decisionId).toBeNull();
    expect(out.response.length).toBeGreaterThanOrEqual(1); // a Conversa ainda comunica
    // Missão nasceu pelo fluxo do Planner, mas SEM carimbo estratégico (legado).
    const ev = await eventStore.readStream('mission', out.missionId as string, 0);
    expect(ev[0]?.provenance.fundamento ?? '').not.toContain('StrategicDecision');
  });

  it('a Conversa recebe as MESMAS intenções do Planner (comportamento intocado)', async () => {
    const { p, conversation } = pipeline(emptySnapshot(CHAT));
    await p.processTurn(input());
    expect(conversation.recebido.some((i) => i.kind === 'conversation')).toBe(true);
  });
});
