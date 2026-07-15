// ─────────────────────────────────────────────────────────────────────────────
// Testes do Lawyer Experience (3D) — o ciclo completo do dia: preparação noturna
// → plantão com delta (nunca recalcula tudo) → decisão parada com fundamento →
// resolução → continuidade automática (cliente informado, memória, auditoria) →
// zero-estado → métricas + BENCHMARK "antes × depois".
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { InboundEnvelope, PlantaoBoard, DecisionRequest, ProductivityReport } from '@reconstrua/application';
import {
  assembleLawyerExperience,
  FakeSleeper,
  InMemoryConversationGateway,
  type AssembledLawyerExperience,
} from '@reconstrua/infrastructure';
import { buildLawyerExperienceServer } from './lawyer-experience-server.js';

class TestClock implements Clock {
  private t = new Date('2026-07-14T03:00:00.000Z');
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

const CHAT = '5511999999999@s.whatsapp.net';

function envelope(kind: 'text' | 'pdf', text: string | null, messageId: string): InboundEnvelope {
  return {
    messageId,
    chatId: CHAT,
    from: CHAT,
    kind,
    text,
    mediaUrl: null,
    mediaMimeType: kind === 'pdf' ? 'application/pdf' : null,
    fileName: kind === 'pdf' ? 'laudo.pdf' : null,
    location: null,
    contact: null,
    reactionEmoji: null,
    reactionToMessageId: null,
    editedText: null,
    deletedMessageId: null,
    silenceMs: null,
    timestamp: new Date('2026-07-14T00:00:00.000Z'),
  };
}

describe('Lawyer Experience (3D) — o advogado nunca começa do zero', () => {
  let app: FastifyInstance;
  let lx: AssembledLawyerExperience;
  let clock: TestClock;
  let gateway: InMemoryConversationGateway;
  let ana = '';
  let missionId = '';
  const H = (): Record<string, string> => ({ 'x-advogado-id': ana });

  beforeAll(async () => {
    clock = new TestClock();
    gateway = new InMemoryConversationGateway(clock);
    lx = assembleLawyerExperience({ clock, uuid: new SeqUuid(), gateway, sleeper: new FakeSleeper(clock) });
    app = buildLawyerExperienceServer(lx);

    // MADRUGADA (03:00): cliente chega e envia documento — a operação trabalha sozinha.
    await lx.op.conversation.receive(envelope('text', 'olá, sou o Carlos', 'M1'));
    await lx.op.conversation.receive(envelope('pdf', null, 'M2'));
    await lx.op.projector.refresh();
    missionId = lx.op.projector.missions()[0]?.missionId ?? '';
    ana = (await lx.op.staff.register('advogado', 'Dra. Ana', null)).id;
    await lx.op.work.assign(missionId, ana, 'admin-1');
  });

  it('PREPARAÇÃO NOTURNA: abre o ponto de decisão (documentação presente → confirmar distribuição)', async () => {
    const res = await app.inject({ method: 'POST', url: '/lx-admin/night-shift' });
    const report: { decisionsOpened: number; missionsPrepared: number } = res.json();
    expect(report.missionsPrepared).toBe(1);
    expect(report.decisionsOpened).toBeGreaterThanOrEqual(1);

    // Idempotente: rodar de novo não duplica.
    await app.inject({ method: 'POST', url: '/lx-admin/night-shift' });
    const open = await lx.gate.awaiting(ana);
    expect(open.filter((d) => d.type === 'confirm_distribution')).toHaveLength(1);
  });

  it('DECISÃO parada: explica, mostra contexto factual e fundamento — e AGUARDA', async () => {
    const res = await app.inject({ method: 'GET', url: '/lx/decisoes', headers: H() });
    const decisions: DecisionRequest[] = res.json();
    const d = decisions.find((x) => x.type === 'confirm_distribution');
    expect(d).toBeDefined();
    expect(d?.explanation).toContain('competência sua');
    expect(d?.context.length).toBeGreaterThanOrEqual(1);
    expect(d?.context[0]).toContain('documento reconhecido');
    expect(d?.fundamento).toContain('DF-09');
    expect(d?.status).toBe('open');
  });

  it('QUADRO DE PLANTÃO às 08:00: onde estou · o que mudou · o que espera — em poucas linhas', async () => {
    clock.advance(5 * 60 * 60_000); // 08:00
    const res = await app.inject({ method: 'GET', url: '/lx/plantao', headers: H() });
    const board: PlantaoBoard = res.json();

    expect(board.missions).toHaveLength(1);
    const m = board.missions[0];
    expect(m?.whereAmI).toContain('Etapa');
    expect(m?.changes.length).toBeGreaterThanOrEqual(1);
    expect(m?.changes.length).toBeLessThanOrEqual(3); // orçamento duro
    expect(m?.awaiting.length).toBeGreaterThanOrEqual(1);
    expect(m?.priorityReason).toContain('RO-3D');
    expect(board.executiveSummary).toHaveLength(4); // aconteceu/decisão/espera/AHRI resolveu
  });

  it('BENCHMARK antes × depois: eventos crus vs. linhas mostradas (dobra auditável)', async () => {
    const quadroRes = await app.inject({ method: 'GET', url: `/lx/processos/${missionId}/quadro`, headers: H() });
    const quadro: { board: { rawNewEvents: number }; fullTimeline: Array<{ count: number; events: unknown[] }> } = quadroRes.json();

    const rawTotal = quadro.fullTimeline.reduce((sum, c) => sum + c.count, 0);
    const shownLines = quadro.fullTimeline.length;
    // ANTES: o advogado leria TODOS os eventos crus. DEPOIS: capítulos dobrados.
    expect(rawTotal).toBeGreaterThanOrEqual(10); // onboarding + documento geram ≥10 eventos
    expect(shownLines).toBeLessThan(rawTotal); // compressão real
    // Nada perdido: os eventos crus continuam dentro dos capítulos.
    expect(quadro.fullTimeline.reduce((sum, c) => sum + c.events.length, 0)).toBe(rawTotal);
  });

  it('CURSOR: após abrir o quadro, o plantão mostra ZERO mudanças (delta, nunca recálculo)', async () => {
    const res = await app.inject({ method: 'GET', url: '/lx/plantao', headers: H() });
    const board: PlantaoBoard = res.json();
    expect(board.missions[0]?.changes).toHaveLength(0); // tudo já visto
    expect(board.missions[0]?.rawNewEvents).toBe(0);
  });

  it('AFTER DECISION: advogado confirma → AHRI continua sozinha (marco + cliente informado + memória + auditoria)', async () => {
    const decisions = await lx.gate.awaiting(ana);
    const d = decisions.find((x) => x.type === 'confirm_distribution');
    const textsBefore = gateway.texts().length;

    const res = await app.inject({
      method: 'POST',
      url: `/lx/decisoes/${d?.id ?? ''}/resolver`,
      headers: H(),
      payload: { accepted: true, note: 'Distribuído na 2ª Vara, processo nº 2026.777' },
    });
    const outcome: { missionContinued: boolean; clientInformed: boolean; ruleRefs: string[] } = res.json();

    expect(outcome.missionContinued).toBe(true);
    expect(outcome.clientInformed).toBe(true);
    expect(outcome.ruleRefs.some((r) => r.startsWith('RO-3B'))).toBe(true);
    expect(gateway.texts().length).toBe(textsBefore + 1); // cliente avisado pela AHRI

    // Marco registrado no trabalho jurídico (timeline do advogado).
    const entries = await lx.op.work.myEntries(ana, 'distribuicao');
    expect(entries).toHaveLength(1);

    // Memória viva atualizada (fato datado com fonte = a decisão).
    const memory = await lx.op.memoryStore.load(CHAT);
    expect(memory?.rememberedEvents.some((e) => e.description.includes('distribuicao'))).toBe(true);

    // A decisão fechou (não aparece mais).
    expect((await lx.gate.awaiting(ana)).some((x) => x.id === d?.id)).toBe(false);
  });

  it('ZERO-ESTADO honesto: sem mudanças e sem decisões, o processo fica quieto', async () => {
    const res = await app.inject({ method: 'GET', url: '/lx/plantao', headers: H() });
    const board: PlantaoBoard = res.json();
    const m = board.missions[0];
    // Sem novos eventos, sem decisões abertas e sem prazos → quiet.
    expect(m?.changes).toHaveLength(0);
    expect(m?.awaiting).toHaveLength(0);
  });

  it('MÉTRICAS: acessos, decisão resolvida, eventos ocultados, comunicações da AHRI, tempo até 1ª decisão', async () => {
    const res = await app.inject({ method: 'GET', url: '/lx/metricas', headers: H() });
    const report: ProductivityReport = res.json();
    expect(report.accesses).toBeGreaterThanOrEqual(2);
    expect(report.decisionsResolved).toBe(1);
    expect(report.eventsHidden).toBeGreaterThanOrEqual(1);
    expect(report.ahriCommunications).toBeGreaterThanOrEqual(1);
    expect(report.timeToFirstDecisionMs).not.toBeNull();
    expect(report.estimatedTimeSavedSeconds).toBeGreaterThan(0);
    expect(report.savingsParams.secondsPerHiddenEvent).toBe(20); // parâmetros declarados
  });

  it('COMPETÊNCIA PRIVATIVA: a AHRI jamais resolve uma decisão; outro advogado não resolve a de Ana', async () => {
    const bruno = (await lx.op.staff.register('advogado', 'Dr. Bruno', null)).id;
    // Abre nova decisão (prazo vencido de Ana).
    await lx.op.work.addEntry({ advogadoId: ana, missionId, kind: 'prazo', text: 'Prazo teste', dueAt: new Date('2026-07-13T00:00:00.000Z') });
    await lx.nightShift.run(clock.now());
    const open = (await lx.gate.awaiting(ana)).find((d) => d.type === 'juridical_review');
    expect(open).toBeDefined();
    // Bruno tenta resolver a decisão de Ana → 403.
    const res = await app.inject({
      method: 'POST',
      url: `/lx/decisoes/${open?.id ?? ''}/resolver`,
      headers: { 'x-advogado-id': bruno },
      payload: { accepted: true },
    });
    expect(res.statusCode).toBe(403);
    // E não existe NENHUMA rota que permita à AHRI resolver: só o POST do advogado dono.
  });
});
