// ─────────────────────────────────────────────────────────────────────────────
// Testes do Portal do Advogado — ISOLAMENTO entre advogados (verificação exigida),
// integração AUTOMÁTICA com a AHRI (Brain decide e o cliente recebe), read models,
// e as fronteiras (401/403; sem founder/financeiro).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { InboundEnvelope } from '@reconstrua/application';
import {
  assembleAdvogadoOperation,
  FakeSleeper,
  InMemoryConversationGateway,
  type AssembledAdvogadoOperation,
} from '@reconstrua/infrastructure';
import { buildAdvogadoServer } from './advogado-server.js';

class TestClock implements Clock {
  private t = new Date('2026-07-14T00:00:00.000Z');
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

function envelope(text: string, messageId: string): InboundEnvelope {
  return {
    messageId,
    chatId: CHAT,
    from: CHAT,
    kind: 'text',
    text,
    mediaUrl: null,
    mediaMimeType: null,
    fileName: null,
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

describe('Portal do Advogado', () => {
  let app: FastifyInstance;
  let op: AssembledAdvogadoOperation;
  let gateway: InMemoryConversationGateway;
  let advogadoA = '';
  let advogadoB = '';
  let missionId = '';

  beforeAll(async () => {
    const clock = new TestClock();
    gateway = new InMemoryConversationGateway(clock);
    op = assembleAdvogadoOperation({ clock, uuid: new SeqUuid(), gateway, sleeper: new FakeSleeper(clock) });
    app = buildAdvogadoServer(op);

    // Operação real: cliente chega pelo WhatsApp → missão nasce.
    await op.conversation.receive(envelope('olá, sou o José', 'M1'));
    await op.projector.refresh();
    missionId = op.projector.missions()[0]?.missionId ?? '';
    expect(missionId).not.toBe('');

    // Dois advogados ativos; o Administrador atribui a missão ao A.
    advogadoA = (await op.staff.register('advogado', 'Dra. Ana', null)).id;
    advogadoB = (await op.staff.register('advogado', 'Dr. Bruno', null)).id;
    await app.inject({
      method: 'POST',
      url: '/advogado-admin/assignments',
      payload: { missionId, advogadoId: advogadoA, assignedBy: 'admin-1' },
    });
  });

  it('sem identificação (ou inativo) → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/advogado/painel' });
    expect(res.statusCode).toBe(401);
    const fake = await app.inject({ method: 'GET', url: '/advogado/painel', headers: { 'x-advogado-id': 'intruso' } });
    expect(fake.statusCode).toBe(401);
  });

  it('ISOLAMENTO: A vê seu processo; B vê lista vazia e recebe 403 no processo de A', async () => {
    const listA = await app.inject({ method: 'GET', url: '/advogado/processos', headers: { 'x-advogado-id': advogadoA } });
    const bodyA: unknown[] = listA.json();
    expect(bodyA).toHaveLength(1);

    const listB = await app.inject({ method: 'GET', url: '/advogado/processos', headers: { 'x-advogado-id': advogadoB } });
    const bodyB: unknown[] = listB.json();
    expect(bodyB).toHaveLength(0);

    const detailB = await app.inject({
      method: 'GET',
      url: `/advogado/processos/${missionId}`,
      headers: { 'x-advogado-id': advogadoB },
    });
    expect(detailB.statusCode).toBe(403);
  });

  it('ISOLAMENTO na escrita: B não consegue registrar atividade no processo de A (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/advogado/processos/${missionId}/atividades`,
      headers: { 'x-advogado-id': advogadoB },
      payload: { kind: 'despacho', text: 'tentativa indevida' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('processo aberto por A: timeline auditável somente-leitura + campos jurídicos', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/advogado/processos/${missionId}`,
      headers: { 'x-advogado-id': advogadoA },
    });
    expect(res.statusCode).toBe(200);
    const body: { timeline: Array<{ actor: string | null }>; juridical: unknown[] } = res.json();
    expect(body.timeline.length).toBeGreaterThan(0);
    expect(body.timeline.every((e) => e.actor === 'AHRI')).toBe(true);
    expect(body.juridical).toBeDefined();
  });

  it('INTEGRAÇÃO AHRI: despacho registrado → Brain decide (RO-3B) → cliente recebe mensagem humanizada', async () => {
    const before = gateway.texts().length;
    const res = await app.inject({
      method: 'POST',
      url: `/advogado/processos/${missionId}/atividades`,
      headers: { 'x-advogado-id': advogadoA },
      payload: { kind: 'despacho', text: 'Despacho favorável ao prosseguimento.' },
    });
    expect(res.statusCode).toBe(200);
    const body: { ahri: { informed: boolean; decidedToSpeak: boolean; ruleRefs: string[] } } = res.json();
    expect(body.ahri.informed).toBe(true);
    expect(body.ahri.decidedToSpeak).toBe(true);
    expect(body.ahri.ruleRefs.some((r) => r.startsWith('RO-3B'))).toBe(true);
    // O CLIENTE recebeu a mensagem — enviada pela AHRI, nunca pelo advogado.
    expect(gateway.texts().length).toBe(before + 1);
    // Presença "digitando" antes do envio (humanização preservada).
    const actions = gateway.actions();
    const lastText = actions.map((a, i) => (a.type === 'text' ? i : -1)).filter((i) => i >= 0).pop() ?? 0;
    expect(actions.slice(0, lastText).some((a) => a.type === 'presence' && a.state === 'composing')).toBe(true);
  });

  it('atividade INTERNA (observação) → Brain decide silêncio (wait) → nenhuma mensagem', async () => {
    const before = gateway.texts().length;
    const res = await app.inject({
      method: 'POST',
      url: `/advogado/processos/${missionId}/atividades`,
      headers: { 'x-advogado-id': advogadoA },
      payload: { kind: 'observacao', text: 'anotação interna de estratégia processual' },
    });
    const body: { ahri: { decidedToSpeak: boolean; ruleRefs: string[] } } = res.json();
    expect(body.ahri.decidedToSpeak).toBe(false);
    expect(body.ahri.ruleRefs).toContain('RO-3B-WAIT-DEFAULT');
    expect(gateway.texts().length).toBe(before);
  });

  it('painel, pendências e agenda refletem o trabalho (prazo cria pendência e alerta ao vencer)', async () => {
    await app.inject({
      method: 'POST',
      url: `/advogado/processos/${missionId}/atividades`,
      headers: { 'x-advogado-id': advogadoA },
      payload: { kind: 'prazo', text: 'Prazo recursal', dueAt: '2026-07-10T00:00:00.000Z' },
    });
    const painel = await app.inject({ method: 'GET', url: '/advogado/painel', headers: { 'x-advogado-id': advogadoA } });
    const body: { processCount: number; pendingCount: number; alerts: string[] } = painel.json();
    expect(body.processCount).toBe(1);
    expect(body.pendingCount).toBeGreaterThanOrEqual(1);
    expect(body.alerts.some((a) => a.includes('Prazo recursal'))).toBe(true);

    const agenda = await app.inject({ method: 'GET', url: '/advogado/agenda', headers: { 'x-advogado-id': advogadoA } });
    const agendaBody: unknown[] = agenda.json();
    expect(agendaBody.length).toBeGreaterThanOrEqual(1);
  });

  it('histórico/protocolos/movimentações/arquivos são SEMPRE do próprio advogado', async () => {
    const historicoB = await app.inject({ method: 'GET', url: '/advogado/historico', headers: { 'x-advogado-id': advogadoB } });
    const bodyB: unknown[] = historicoB.json();
    expect(bodyB).toHaveLength(0); // B não vê o trabalho de A
    const historicoA = await app.inject({ method: 'GET', url: '/advogado/historico', headers: { 'x-advogado-id': advogadoA } });
    const bodyA: unknown[] = historicoA.json();
    expect(bodyA.length).toBeGreaterThanOrEqual(3);
  });
});
