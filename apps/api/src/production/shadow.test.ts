// ─────────────────────────────────────────────────────────────────────────────
// Testes do SHADOW MODE (4D) — o recorder captura o report completo sem alterar o
// comportamento; detecções disparam nos padrões certos; feedback humano; perguntas
// do fundador respondidas EXCLUSIVAMENTE dos Shadow Reports; Shadow Center via API.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { InboundEnvelope } from '@reconstrua/application';
import {
  assembleProduction,
  detect,
  summarize,
  askShadow,
  FakeSleeper,
  InMemoryConversationGateway,
  type ShadowReport,
} from '@reconstrua/infrastructure';
import { buildProductionServer } from './production-server.js';

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

const CHAT = '5511977776666@s.whatsapp.net';

function env(text: string, messageId: string, over: Partial<InboundEnvelope> = {}): InboundEnvelope {
  return {
    messageId, chatId: CHAT, from: CHAT, kind: 'text', text, mediaUrl: null, mediaMimeType: null, fileName: null,
    location: null, contact: null, reactionEmoji: null, reactionToMessageId: null, editedText: null,
    deletedMessageId: null, silenceMs: null, timestamp: new Date('2026-07-14T09:00:00.000Z'), ...over,
  };
}

function harness(shadowMode = true) {
  const clock = new TestClock();
  const gateway = new InMemoryConversationGateway(clock);
  const prod = assembleProduction({
    clock,
    uuid: new SeqUuid(),
    env: { SHADOW_MODE: shadowMode ? 'true' : 'false' },
    gateway,
    sleeper: new FakeSleeper(clock),
  });
  return { prod, clock, gateway };
}

describe('Shadow Mode — recorder', () => {
  it('cada turno gera um Shadow Report completo SEM alterar o comportamento', async () => {
    const { prod, gateway } = harness();
    const result = await prod.ingress.receive(env('olá, sou a Maria', 'S1'));
    expect(result.skipped).toBe(false);
    expect(gateway.texts()).toHaveLength(1); // comportamento normal preservado

    const reports = await prod.shadowStore.all();
    expect(reports).toHaveLength(1);
    const r = reports[0] as ShadowReport;
    expect(r.chatId).toBe(CHAT);
    expect(r.perceptKind).toBe('text');
    expect(r.rulesApplied.some((ref) => ref.startsWith('RO-'))).toBe(true);
    expect(r.intents.length).toBeGreaterThanOrEqual(1);
    expect(r.responses).toHaveLength(1);
    expect(r.decisionTimeMs).toBeGreaterThanOrEqual(0);
    expect(r.missionId).not.toBeNull();
    expect(r.llm.provider).toBe('offline');
    expect(r.outcome).toBe('delivered');
    expect(r.humanFeedback).toBeNull();
  });

  it('SHADOW_MODE=false → nenhum report (comportamento idêntico)', async () => {
    const { prod } = harness(false);
    await prod.ingress.receive(env('olá', 'S1'));
    expect(await prod.shadowStore.all()).toHaveLength(0);
  });

  it('turno temporal também gera report (origin=temporal) com a RO de follow-up', async () => {
    const { prod, clock } = harness();
    await prod.ingress.receive(env('olá', 'S1'));
    clock.advance(4 * 24 * 60 * 60_000);
    await prod.ingress.tick(clock.now());
    const reports = await prod.shadowStore.all();
    const temporal = reports.find((r) => r.origin === 'temporal');
    expect(temporal).toBeDefined();
    expect(temporal?.rulesApplied).toContain('RO-4C-FOLLOWUP-TIMEOUT');
  });

  it('feedback humano é anexável e auditável', async () => {
    const { prod } = harness();
    await prod.ingress.receive(env('olá', 'S1'));
    const [r] = await prod.shadowStore.all();
    const updated = await prod.shadow.addFeedback(r?.id ?? '', 'resposta adequada, tom bom');
    expect(updated?.humanFeedback).toBe('resposta adequada, tom bom');
    expect((await prod.shadowStore.byId(r?.id ?? ''))?.humanFeedback).toBe('resposta adequada, tom bom');
  });
});

describe('Shadow Mode — detecção automática', () => {
  function report(over: Partial<ShadowReport>): ShadowReport {
    return {
      id: 'r', at: new Date('2026-07-14T10:00:00.000Z'), chatId: 'c1', origin: 'inbound', perceptKind: 'text',
      messageId: 'm', sentiment: 'neutral', urgency: 'normal', turnCount: 1, missionId: null, workflowSteps: [],
      truthCount: 0, stateCount: 0, stageCount: 0, rulesApplied: ['RO-X'], intents: ['speak[RO-X]'],
      decisionTimeMs: 100, responses: ['ok'], latencyMs: 100,
      llm: { provider: 'offline', calls: 0, tokensIn: null, tokensOut: null },
      outcome: 'delivered', error: null, humanFeedback: null, ...over,
    };
  }

  it('detecta loop, spam, repetição, cliente irritado e RO nunca usada', () => {
    const reports: ShadowReport[] = [];
    // loop+spam: 40 turnos com 1 resposta cada na mesma hora
    for (let i = 0; i < 40; i += 1) reports.push(report({ id: `l${String(i)}`, chatId: 'loopy' }));
    // repetição exata
    reports.push(report({ id: 'rep1', chatId: 'rep', responses: ['a mesma frase exata aqui'] }));
    reports.push(report({ id: 'rep2', chatId: 'rep', responses: ['a mesma frase exata aqui'] }));
    // irritado
    for (let i = 0; i < 3; i += 1) reports.push(report({ id: `n${String(i)}`, chatId: 'bravo', sentiment: 'negative' }));

    const detections = detect(reports, ['RO-X', 'RO-NUNCA-USADA']);
    const kinds = detections.map((d) => d.kind);
    expect(kinds).toContain('loop');
    expect(kinds).toContain('spam');
    expect(kinds).toContain('mensagem-repetida');
    expect(kinds).toContain('cliente-irritado');
    expect(detections.some((d) => d.kind === 'ro-nunca-usada' && d.detail === 'RO-NUNCA-USADA')).toBe(true);
    // severidades corretas
    expect(detections.find((d) => d.kind === 'loop')?.severity).toBe('CRITICO');
    expect(detections.find((d) => d.kind === 'mensagem-repetida')?.severity).toBe('ALTO');
  });

  it('operação saudável → sem CRÍTICO/ALTO', () => {
    const reports = [report({ id: 'a' }), report({ id: 'b', chatId: 'c2', responses: ['outra frase bem diferente agora'] })];
    const detections = detect(reports, ['RO-X']);
    expect(detections.filter((d) => d.severity === 'CRITICO' || d.severity === 'ALTO')).toHaveLength(0);
  });
});

describe('Shadow Mode — perguntas do fundador (exclusivamente dos reports)', () => {
  it('responde as 7 perguntas com base factual e nunca inventa', async () => {
    const { prod, clock } = harness();
    await prod.ingress.receive(env('olá, sou a Maria', 'S1'));
    clock.advance(4 * 24 * 60 * 60_000);
    await prod.ingress.tick(clock.now());
    const reports = await prod.shadowStore.all();
    const detections = detect(reports, ['RO-2D-GREET']);
    const ctx = { reports, detections, lawyerLoad: { 'Dra. Ana': 3, 'Dr. Bruno': 1 }, pendingDocs: [{ chatId: CHAT, document: 'CPF', sinceDays: 2 }] };

    expect(askShadow('qual foi sua decisão mais difícil hoje?', ctx).answer).toContain('ms');
    expect(askShadow('em quais regras você mais trabalhou?', ctx).answer).toContain('RO-');
    expect(askShadow('qual advogado está sobrecarregado?', ctx).answer).toContain('Dra. Ana');
    expect(askShadow('quais documentos estão atrasando?', ctx).answer).toContain('CPF');
    const weird = askShadow('existe algum comportamento estranho?', ctx);
    expect(weird.provenance).toBe('shadow-reports');
    const unknown = askShadow('qual o sentido da vida?', ctx);
    expect(unknown.available).toBe(false);
    expect(unknown.answer).toContain('não vou inventar');
  });
});

describe('Shadow Center — API', () => {
  it('/production/shadow/center agrega tudo em tempo real', async () => {
    const { prod } = harness();
    const app = buildProductionServer({ prod, env: {}, startedAt: new Date() });
    await prod.ingress.receive(env('olá', 'S1'));

    const res = await app.inject({ method: 'GET', url: '/production/shadow/center' });
    const body: { shadowMode: boolean; summary: { totalTurns: number; conversations: number }; detections: unknown[]; recent: unknown[] } = res.json();
    expect(body.shadowMode).toBe(true);
    expect(body.summary.totalTurns).toBe(1);
    expect(body.summary.conversations).toBe(1);
    expect(body.recent).toHaveLength(1);

    const ask = await app.inject({ method: 'POST', url: '/production/shadow/ask', payload: { question: 'em quais regras você mais trabalhou?' } });
    const answer: { answer: string; provenance: string } = ask.json();
    expect(answer.provenance).toBe('shadow-reports');
    expect(answer.answer).toContain('RO-');
  });

  it('summarize calcula latências e uso de regras', () => {
    const s = summarize([]);
    expect(s.totalTurns).toBe(0);
  });
});
