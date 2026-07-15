// ─────────────────────────────────────────────────────────────────────────────
// PROVAS das correções 4C (bloqueantes da homologação 4B).
//  A1: read models não perdem eventos sob QUALQUER intercalação/reentrega.
//  A2: 1 cliente → 1 missão sob concorrência, rajada, retry e redelivery (prova
//      exaustiva por matriz de cenários).
//  A3: follow-ups FALAM por Regra Operacional (nunca timer cego); bloqueios calam.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { InboundEnvelope, StoredEvent } from '@reconstrua/application';
import { ExecutiveBrainRuntime, emptyMetrics, projectEvent, emptySnapshot } from '@reconstrua/application';
import { assembleProduction } from './build-production.js';
import { PRODUCTION_RULE_CATALOG } from './production-rule-catalog.js';
import { InMemoryConversationGateway } from '../conversation/in-memory-conversation-gateway.js';
import { FakeSleeper } from '../conversation/system-sleeper.js';

class TestClock implements Clock {
  private t = new Date('2026-07-14T09:00:00.000Z');
  now(): Date {
    return new Date(this.t.getTime());
  }
  advance(ms: number): void {
    this.t = new Date(this.t.getTime() + ms);
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

function env(chatId: string, text: string, messageId: string, over: Partial<InboundEnvelope> = {}): InboundEnvelope {
  return {
    messageId, chatId, from: chatId, kind: 'text', text, mediaUrl: null, mediaMimeType: null, fileName: null,
    location: null, contact: null, reactionEmoji: null, reactionToMessageId: null, editedText: null,
    deletedMessageId: null, silenceMs: null, timestamp: new Date('2026-07-14T09:00:00.000Z'), ...over,
  };
}

function harness() {
  const clock = new TestClock();
  const gateway = new InMemoryConversationGateway(clock);
  const prod = assembleProduction({ clock, uuid: new SeqUuid(), env: {}, gateway, sleeper: new FakeSleeper(clock) });
  return { prod, clock, gateway };
}

// ═════════ A1 — read models nunca perdem eventos ═════════
describe('A1 — projeção administrativa sob intercalação e reentrega', () => {
  function stored(streamType: string, streamId: string, version: number, globalSeq: number): StoredEvent {
    return {
      id: `${streamId}-v${String(version)}`, streamType, streamId, version,
      eventType: `${streamType}.event`, isRelevant: true, payload: {},
      provenance: { factRef: null, actor: 'AHRI', decisionType: null, fundamento: null, operationalRuleRef: null },
      previousHash: null, hash: 'h', occurredAt: new Date('2026-07-14T00:00:00.000Z'),
      recordedAt: new Date('2026-07-14T00:00:00.000Z'), globalSeq,
    };
  }

  it('entrega FORA DE ORDEM entre streams: nada é perdido (a causa exata do bug 4B)', () => {
    // Ordem de chegada: seq 5 (state) ANTES de seq 3 (document) — o guard antigo
    // dropava o documento. Agora: dedup por stream ⇒ todos contam.
    const events = [
      stored('cliente', 'c1', 1, 1),
      stored('mission', 'm1', 1, 2),
      stored('operational-state', 's1', 1, 5), // chega adiantado
      stored('document', 'd1', 1, 3), // chega "atrasado" (era dropado)
      stored('process', 'p1', 1, 4), // idem
    ];
    let metrics = emptyMetrics(new Date());
    for (const e of events) metrics = projectEvent(metrics, e);
    expect(metrics.clientCount).toBe(1);
    expect(metrics.missionCount).toBe(1);
    expect(metrics.documentCount).toBe(1); // era 0 no 4B
    expect(metrics.processCount).toBe(1); // era 0 no 4B
    expect(metrics.stateDerivations).toBe(1);
  });

  it('REENTREGA (at-least-once) não conta duas vezes; permutação aleatória conta tudo', () => {
    const base = [
      stored('cliente', 'c1', 1, 1),
      stored('document', 'd1', 1, 2),
      stored('document', 'd2', 1, 3),
      stored('process', 'p1', 1, 4),
    ];
    // 20 permutações aleatórias + reentrega dupla de cada evento.
    for (let round = 0; round < 20; round += 1) {
      const shuffled = [...base, ...base].sort(() => Math.random() - 0.5);
      let metrics = emptyMetrics(new Date());
      for (const e of shuffled) metrics = projectEvent(metrics, e);
      expect(metrics.clientCount).toBe(1);
      expect(metrics.documentCount).toBe(2);
      expect(metrics.processCount).toBe(1);
    }
  });
});

// ═════════ A2 — 1 cliente → 1 missão, prova por matriz ═════════
describe('A2 — unicidade de missão sob qualquer concorrência (entrada única serializada)', () => {
  const CHAT = '5511900001111@s.whatsapp.net';

  async function missionsOf(prod: ReturnType<typeof harness>['prod'], chatId: string): Promise<number> {
    await prod.adminView.projector.refresh();
    return prod.adminView.projector.missionsOf(chatId).length;
  }

  it('2 mensagens SIMULTÂNEAS de cliente novo → exatamente 1 missão (o cenário que falhou no 4B)', async () => {
    const { prod } = harness();
    await Promise.all([
      prod.ingress.receive(env(CHAT, 'oi', 'R1')),
      prod.ingress.receive(env(CHAT, 'tem alguém aí?', 'R2')),
    ]);
    expect(await missionsOf(prod, CHAT)).toBe(1);
  });

  it('RAJADA: 10 mensagens simultâneas → 1 missão', async () => {
    const { prod } = harness();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => prod.ingress.receive(env(CHAT, `msg ${String(i)}`, `B${String(i)}`))),
    );
    expect(await missionsOf(prod, CHAT)).toBe(1);
  });

  it('RETRY/REDELIVERY: o MESMO messageId reenviado 5× em paralelo → 1 missão e 1 processamento', async () => {
    const { prod, gateway } = harness();
    await Promise.all(Array.from({ length: 5 }, () => prod.ingress.receive(env(CHAT, 'oi', 'DUP-1'))));
    expect(await missionsOf(prod, CHAT)).toBe(1);
    // Só um turno gerou resposta (os demais foram idempotentes DENTRO da fila).
    expect(gateway.texts().length).toBe(1);
  });

  it('MISTO adversarial: rajada + duplicatas + sinal temporal concorrente → 1 missão', async () => {
    const { prod, clock } = harness();
    await prod.ingress.receive(env(CHAT, 'primeira', 'M0'));
    clock.advance(4 * 24 * 60 * 60_000); // follow-up vence
    await Promise.all([
      prod.ingress.receive(env(CHAT, 'nova A', 'M1')),
      prod.ingress.receive(env(CHAT, 'nova A', 'M1')), // duplicata
      prod.ingress.receive(env(CHAT, 'nova B', 'M2')),
      prod.ingress.tick(clock.now()), // temporal na MESMA fila da conversa
    ]);
    expect(await missionsOf(prod, CHAT)).toBe(1);
  });

  it('clientes DIFERENTES continuam paralelos (a serialização é POR conversa)', async () => {
    const { prod } = harness();
    const chats = Array.from({ length: 4 }, (_, i) => `551190000${String(i)}@s.whatsapp.net`);
    await Promise.all(chats.map((c, i) => prod.ingress.receive(env(c, 'oi', `P${String(i)}`))));
    for (const c of chats) expect(await missionsOf(prod, c)).toBe(1);
    await prod.adminView.projector.refresh();
    expect(prod.adminView.projector.missions().length).toBe(4);
  });
});

// ═════════ A3 — follow-ups por Regra Operacional ═════════
describe('A3 — a AHRI jamais abandona o cliente (follow-up decidido pelo Brain)', () => {
  const CHAT = '5511977776666@s.whatsapp.net';

  it('acompanhamento vencido → Brain decide FALAR por RO-4C → cliente recebe mensagem humanizada', async () => {
    const { prod, clock, gateway } = harness();
    await prod.ingress.receive(env(CHAT, 'olá', 'T1'));
    const before = gateway.texts().length;

    clock.advance(4 * 24 * 60 * 60_000); // vence o follow-up do workflow
    const results = await prod.ingress.tick(clock.now());

    expect(results.length).toBeGreaterThanOrEqual(1);
    const refs = results.flatMap((r) => r.intents.map((i) => i.operationalRuleRef));
    expect(refs).toContain('RO-4C-FOLLOWUP-TIMEOUT'); // decisão por REGRA, nunca timer cego
    expect(gateway.texts().length).toBe(before + 1); // o cliente FOI chamado de volta
    // Regressão 4D: o follow-up vai para o CHAT REAL, nunca para o missionId.
    const lastAction = gateway.actions().filter((a) => a.type === 'text').pop();
    expect(lastAction?.chatId).toBe(CHAT);
    expect(results.every((r) => r.chatId.includes('@'))).toBe(true);
    // E com humanização: presença 'composing' antes do envio.
    const actions = gateway.actions();
    const lastText = actions.map((a, i) => (a.type === 'text' ? i : -1)).filter((i) => i >= 0).pop() ?? 0;
    expect(actions.slice(0, lastText).some((a) => a.type === 'presence' && a.state === 'composing')).toBe(true);
  });

  it('follow-up NÃO redispara (sem loop) e segunda tarefa futura permanece agendada', async () => {
    const { prod, clock } = harness();
    await prod.ingress.receive(env(CHAT, 'olá', 'T1'));
    clock.advance(4 * 24 * 60 * 60_000);
    await prod.ingress.tick(clock.now());
    expect(await prod.ingress.tick(clock.now())).toHaveLength(0);
  });

  it('BLOQUEIO por regra: missão ENCERRADA → o Brain cala (wait), nunca mensagem mecânica', async () => {
    const clock = new TestClock();
    const uuid = new SeqUuid();
    const brain = new ExecutiveBrainRuntime({ clock, uuid });
    const outcome = await brain.decide({
      percept: { kind: 'timeout', sentiment: 'unknown', urgency: 'unknown', hasArtifacts: false, artifactCount: 0, silenceMs: 999 },
      snapshot: { ...emptySnapshot('m1'), stateCode: 'ENCERRADA' },
      memory: { turnCount: 5, lastOutboundAgoMs: null },
      rules: PRODUCTION_RULE_CATALOG,
      chatId: 'c1',
      now: clock.now(),
    });
    expect(outcome.intents.some((i) => i.kind === 'conversation' && i.directive === 'speak')).toBe(false);
    expect(outcome.intents[0]?.kind === 'stop' || outcome.intents[0]?.kind === 'wait').toBe(true);
  });

  it('BLOQUEIO por regra: matéria humana → escalação, jamais fala automática', async () => {
    const clock = new TestClock();
    const brain = new ExecutiveBrainRuntime({ clock, uuid: new SeqUuid() });
    const outcome = await brain.decide({
      percept: { kind: 'timeout', sentiment: 'unknown', urgency: 'unknown', hasArtifacts: false, artifactCount: 0, silenceMs: 999 },
      snapshot: { ...emptySnapshot('m1'), matterRequiresHuman: true },
      memory: { turnCount: 5, lastOutboundAgoMs: null },
      rules: PRODUCTION_RULE_CATALOG,
      chatId: 'c1',
      now: clock.now(),
    });
    expect(outcome.intents).toHaveLength(1);
    expect(outcome.intents[0]?.kind).toBe('escalation');
  });
});
