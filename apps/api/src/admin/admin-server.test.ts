// ─────────────────────────────────────────────────────────────────────────────
// Testes da API do Portal Administrativo — todas as respostas nascem dos READ
// MODELS reais, alimentados pela operação de verdade (um turno de WhatsApp).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { InboundEnvelope } from '@reconstrua/application';
import { assembleAdminOperation, FakeSleeper, type AssembledAdminOperation } from '@reconstrua/infrastructure';
import { buildAdminServer } from './admin-server.js';

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

describe('Admin Portal API', () => {
  let app: FastifyInstance;
  let op: AssembledAdminOperation;

  beforeAll(async () => {
    const clock = new TestClock();
    op = assembleAdminOperation({ clock, uuid: new SeqUuid(), sleeper: new FakeSleeper(clock) });
    // Um turno REAL: cliente diz "olá" → missão nasce → read models projetados.
    await op.conversation.receive(envelope('olá, meu nome é Maria', 'M1'));
    app = buildAdminServer(op);
  });

  it('GET /admin/dashboard — métricas reais dos read models', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/dashboard' });
    expect(res.statusCode).toBe(200);
    const body: { activeClients: number; messageCount: number; expectedFees: null; overall: string } = res.json();
    expect(body.activeClients).toBe(1);
    expect(body.messageCount).toBeGreaterThanOrEqual(1);
    expect(body.expectedFees).toBeNull(); // sem fonte → nunca inventado
  });

  it('GET /admin/clients — lista e pesquisa', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/clients?q=maria' });
    const body: Array<{ chatId: string; name: string | null; missions: string[] }> = res.json();
    expect(body).toHaveLength(1);
    expect(body[0]?.chatId).toBe(CHAT);
    expect(body[0]?.missions.length).toBeGreaterThanOrEqual(1);
    const miss = await app.inject({ method: 'GET', url: '/admin/clients?q=inexistente' });
    expect(miss.json()).toHaveLength(0);
  });

  it('GET /admin/clients/:chatId — memória, relationship, conversa e missões', async () => {
    const res = await app.inject({ method: 'GET', url: `/admin/clients/${encodeURIComponent(CHAT)}` });
    expect(res.statusCode).toBe(200);
    const body: { memory: { messageCount: number }; relationship: { summary: string }; conversation: unknown[]; missions: unknown[] } = res.json();
    expect(body.memory.messageCount).toBe(1);
    expect(body.relationship.summary.length).toBeGreaterThan(0);
    expect(body.conversation.length).toBeGreaterThan(0);
    expect(body.missions.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /admin/missions + /admin/missions/:id — timeline auditável (proveniência)', async () => {
    const list = await app.inject({ method: 'GET', url: '/admin/missions' });
    const missions: Array<{ missionId: string; chatId: string | null }> = list.json();
    expect(missions.length).toBeGreaterThanOrEqual(1);
    expect(missions[0]?.chatId).toBe(CHAT);

    const detail = await app.inject({ method: 'GET', url: `/admin/missions/${missions[0]?.missionId ?? ''}` });
    const body: { timeline: Array<{ eventType: string; actor: string | null; operationalRuleRef: string | null }> } = detail.json();
    expect(body.timeline.some((e) => e.eventType === 'mission.created')).toBe(true);
    expect(body.timeline.every((e) => e.actor === 'AHRI')).toBe(true);
    expect(body.timeline.every((e) => (e.operationalRuleRef ?? '').startsWith('RO-'))).toBe(true);
  });

  it('missão inexistente → 404 (nunca inventa)', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/missions/nao-existe' });
    expect(res.statusCode).toBe(404);
  });

  it('staff — cadastrar, editar, desativar, carga', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/admin/staff',
      payload: { role: 'advogado', name: 'Dra. Ana', email: 'ana@escritorio.com' },
    });
    expect(created.statusCode).toBe(200);
    const member: { id: string; active: boolean } = created.json();
    expect(member.active).toBe(true);

    const deactivated = await app.inject({ method: 'PATCH', url: `/admin/staff/${member.id}`, payload: { active: false } });
    const deactivatedBody: { active: boolean } = deactivated.json();
    expect(deactivatedBody.active).toBe(false);

    const listed = await app.inject({ method: 'GET', url: '/admin/staff/advogado' });
    const body: { members: unknown[]; workload: { role: string; openHandoffs: number } } = listed.json();
    expect(body.members).toHaveLength(1);
    expect(body.workload.role).toBe('advogado');

    const invalid = await app.inject({ method: 'GET', url: '/admin/staff/juiz' });
    expect(invalid.statusCode).toBe(400);
  });

  it('founder console — briefing e pergunta com proveniência (nunca decide)', async () => {
    const briefing = await app.inject({ method: 'GET', url: '/admin/founder/briefing' });
    const briefingBody: { greeting: string } = briefing.json();
    expect(briefingBody.greeting.length).toBeGreaterThan(0);

    const ask = await app.inject({ method: 'POST', url: '/admin/founder/ask', payload: { question: 'quantos clientes temos?' } });
    const answer: { answer: string; provenance: string; decidesNothing: true } = ask.json();
    expect(answer.answer).toContain('1');
    expect(answer.provenance.length).toBeGreaterThan(0);
    expect(answer.decidesNothing).toBe(true);

    const empty = await app.inject({ method: 'POST', url: '/admin/founder/ask', payload: {} });
    expect(empty.statusCode).toBe(400);
  });

  it('logs pesquisáveis + health + financeiro/campanhas sem fonte = explícito', async () => {
    const logs = await app.inject({ method: 'GET', url: '/admin/logs?q=mission.created' });
    const body: { events: Array<{ eventType: string }> } = logs.json();
    expect(body.events.some((e) => e.eventType === 'mission.created')).toBe(true);

    const health = await app.inject({ method: 'GET', url: '/admin/health' });
    const healthBody: { components: unknown[] } = health.json();
    expect(healthBody.components).toBeDefined();

    const finance = await app.inject({ method: 'GET', url: '/admin/finance' });
    const financeBody: { available: boolean } = finance.json();
    expect(financeBody.available).toBe(false);
    const campaigns = await app.inject({ method: 'GET', url: '/admin/campaigns' });
    const campaignsBody: { available: boolean } = campaigns.json();
    expect(campaignsBody.available).toBe(false);
  });
});
