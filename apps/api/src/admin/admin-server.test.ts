// ─────────────────────────────────────────────────────────────────────────────
// Testes da API do Portal Administrativo — todas as respostas nascem dos READ
// MODELS reais, alimentados pela operação de verdade (um turno de WhatsApp).
// BL-2.1 (DF-12): as rotas /admin/* exigem autenticação (Bearer); os testes
// autenticam via helper `call` e provam também o bloqueio (401).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { InboundEnvelope } from '@reconstrua/application';
import {
  assembleAdminOperation,
  FakeSleeper,
  type AssembledAdminOperation,
} from '@reconstrua/infrastructure';
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
const ADMIN_SECRET = 'TEST-ADMIN-SECRET';

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

  /** Injeta já autenticado (Bearer) — reflete o portal com o segredo do Admin. */
  function call(opts: { method: 'GET' | 'POST' | 'PATCH'; url: string; payload?: object }) {
    return app.inject({ ...opts, headers: { authorization: `Bearer ${ADMIN_SECRET}` } });
  }

  beforeAll(async () => {
    const clock = new TestClock();
    op = assembleAdminOperation({ clock, uuid: new SeqUuid(), sleeper: new FakeSleeper(clock) });
    // Um turno REAL: cliente diz "olá" → missão nasce → read models projetados.
    await op.conversation.receive(envelope('olá, meu nome é Maria', 'M1'));
    app = buildAdminServer(op, { accessSecret: ADMIN_SECRET });
  });

  it('GET /admin/dashboard — métricas reais dos read models', async () => {
    const res = await call({ method: 'GET', url: '/admin/dashboard' });
    expect(res.statusCode).toBe(200);
    const body: {
      activeClients: number;
      messageCount: number;
      expectedFees: null;
      overall: string;
    } = res.json();
    expect(body.activeClients).toBe(1);
    expect(body.messageCount).toBeGreaterThanOrEqual(1);
    expect(body.expectedFees).toBeNull(); // sem fonte → nunca inventado
  });

  it('GET /admin/clients (lista LEGACY) foi REMOVIDA — a lista única é /admin/jornada/clientes', async () => {
    const res = await call({ method: 'GET', url: '/admin/clients?q=maria' });
    expect(res.statusCode).toBe(404); // Regra 2: sem convivência de duas listagens
  });

  it('GET /admin/clients/:chatId — memória, relationship, conversa e missões', async () => {
    const res = await call({ method: 'GET', url: `/admin/clients/${encodeURIComponent(CHAT)}` });
    expect(res.statusCode).toBe(200);
    const body: {
      memory: { messageCount: number };
      relationship: { summary: string };
      conversation: unknown[];
      missions: unknown[];
    } = res.json();
    expect(body.memory.messageCount).toBe(1);
    expect(body.relationship.summary.length).toBeGreaterThan(0);
    expect(body.conversation.length).toBeGreaterThan(0);
    expect(body.missions.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /admin/missions + /admin/missions/:id — timeline auditável (proveniência)', async () => {
    const list = await call({ method: 'GET', url: '/admin/missions' });
    const missions: Array<{ missionId: string; chatId: string | null }> = list.json();
    expect(missions.length).toBeGreaterThanOrEqual(1);
    expect(missions[0]?.chatId).toBe(CHAT);

    const detail = await call({
      method: 'GET',
      url: `/admin/missions/${missions[0]?.missionId ?? ''}`,
    });
    const body: {
      timeline: Array<{
        eventType: string;
        actor: string | null;
        operationalRuleRef: string | null;
      }>;
    } = detail.json();
    expect(body.timeline.some((e) => e.eventType === 'mission.created')).toBe(true);
    expect(body.timeline.every((e) => e.actor === 'AHRI')).toBe(true);
    expect(body.timeline.every((e) => (e.operationalRuleRef ?? '').startsWith('RO-'))).toBe(true);
  });

  it('missão inexistente → 404 (nunca inventa)', async () => {
    const res = await call({ method: 'GET', url: '/admin/missions/nao-existe' });
    expect(res.statusCode).toBe(404);
  });

  it('B4.1 — encerrar missão inexistente → 404', async () => {
    const res = await call({
      method: 'POST',
      url: '/admin/missions/nao-existe/encerrar',
      payload: { reason: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('B4.1 — encerrar processo oficialmente (Estado terminal ENCERRADA) e projetar o encerramento', async () => {
    const list = await call({ method: 'GET', url: '/admin/missions' });
    const missions: Array<{ missionId: string }> = list.json();
    const missionId = missions[0]?.missionId ?? '';

    const res = await call({
      method: 'POST',
      url: `/admin/missions/${missionId}/encerrar`,
      payload: { reason: 'perícia concluída' },
    });
    expect(res.statusCode).toBe(200);
    const body: { closed: boolean; skipped: boolean; stateId: string | null } = res.json();
    expect(body.closed).toBe(true);
    expect(body.skipped).toBe(false);
    expect(body.stateId).not.toBeNull();

    // A timeline registra a derivação do Estado terminal (auditável, com proveniência).
    const detail = await call({ method: 'GET', url: `/admin/missions/${missionId}` });
    const detailBody: {
      timeline: Array<{ eventType: string; streamType: string; actor: string | null }>;
    } = detail.json();
    expect(detailBody.timeline.some((e) => e.streamType === 'operational-state')).toBe(true);
  });

  it('B4.3 — reabrir missão inexistente → 404', async () => {
    const res = await call({
      method: 'POST',
      url: '/admin/missions/nao-existe/reabrir',
      payload: { reason: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('B4.3 — reabrir processo (evento append-only) devolve o processo ao operacional', async () => {
    const list = await call({ method: 'GET', url: '/admin/missions' });
    const missions: Array<{ missionId: string }> = list.json();
    const missionId = missions[0]?.missionId ?? '';

    const before = await call({ method: 'GET', url: `/admin/missions/${missionId}` });
    const beforeBody: { timeline: unknown[] } = before.json();
    const beforeLen = beforeBody.timeline.length;

    const res = await call({
      method: 'POST',
      url: `/admin/missions/${missionId}/reabrir`,
      payload: { reason: 'novo fato jurídico' },
    });
    expect(res.statusCode).toBe(200);
    const body: { reopened: boolean; stateId: string | null } = res.json();
    expect(body.reopened).toBe(true);
    expect(body.stateId).not.toBeNull();

    // Append-only: a reabertura SOMA um evento à timeline (nada é reescrito).
    const after = await call({ method: 'GET', url: `/admin/missions/${missionId}` });
    const afterBody: { timeline: unknown[] } = after.json();
    expect(afterBody.timeline.length).toBeGreaterThan(beforeLen);
  });

  it('B4.4 — GET /admin/metrics/operacional agrega os indicadores dos read models', async () => {
    // Neste ponto: 1 missão, encerrada (B4.1) e depois reaberta (B4.3).
    const res = await call({ method: 'GET', url: '/admin/metrics/operacional' });
    expect(res.statusCode).toBe(200);
    const m: {
      totalProcessos: number;
      processosAtivos: number;
      processosEncerrados: number;
      processosReabertos: number;
      followUpsPendentes: number;
      followUpsEnviados: number;
      tempoMedioEntreInteracoesMs: number | null;
      tempoMedioAteEncerramentoMs: number | null;
      casosPorAdvogado: Record<string, number>;
      casosPorEtapa: Record<string, number>;
      casosAguardandoCliente: number;
    } = res.json();

    expect(m.totalProcessos).toBe(1);
    expect(m.processosReabertos).toBe(1); // foi reaberta uma vez
    expect(m.processosEncerrados).toBe(0); // reaberta ⇒ não terminal
    expect(m.processosAtivos).toBe(1);
    // Contrato completo dos 10 indicadores presente (nunca inventado; null quando ausente).
    expect(typeof m.followUpsPendentes).toBe('number');
    expect(typeof m.followUpsEnviados).toBe('number');
    expect(m.casosPorEtapa).toBeDefined();
    expect(m.casosPorAdvogado).toBeDefined();
    expect(typeof m.casosAguardandoCliente).toBe('number');
  });

  it('staff — cadastrar, editar, desativar, carga', async () => {
    const created = await call({
      method: 'POST',
      url: '/admin/staff',
      payload: { role: 'advogado', name: 'Dra. Ana', email: 'ana@escritorio.com' },
    });
    expect(created.statusCode).toBe(200);
    const member: { id: string; active: boolean } = created.json();
    expect(member.active).toBe(true);

    const deactivated = await call({
      method: 'PATCH',
      url: `/admin/staff/${member.id}`,
      payload: { active: false },
    });
    const deactivatedBody: { active: boolean } = deactivated.json();
    expect(deactivatedBody.active).toBe(false);

    const listed = await call({ method: 'GET', url: '/admin/staff/advogado' });
    const body: { members: unknown[]; workload: { role: string; openHandoffs: number } } =
      listed.json();
    expect(body.members).toHaveLength(1);
    expect(body.workload.role).toBe('advogado');

    const invalid = await call({ method: 'GET', url: '/admin/staff/juiz' });
    expect(invalid.statusCode).toBe(400);
  });

  // ── GO-LIVE-05 · BUG 1: bootstrap ONE-TIME, server-authoritative ─────────────
  it('bootstrap acontece UMA vez e persiste; depois GET /admin/bootstrap = true para sempre', async () => {
    const antes = await call({ method: 'GET', url: '/admin/bootstrap' });
    expect(antes.statusCode).toBe(200);
    const antesBody: { bootstrapped: boolean } = antes.json();
    expect(antesBody.bootstrapped).toBe(false);

    const criar = await call({
      method: 'POST',
      url: '/admin/bootstrap',
      payload: { name: 'Jessé Fundador' },
    });
    expect(criar.statusCode).toBe(200);
    const criarBody: { bootstrapped: boolean; member: { name: string } } = criar.json();
    expect(criarBody.member.name).toBe('Jessé Fundador');

    // Releitura (equivale ao próximo login após logout): permanece inicializado.
    const depois = await call({ method: 'GET', url: '/admin/bootstrap' });
    const depoisBody: { bootstrapped: boolean } = depois.json();
    expect(depoisBody.bootstrapped).toBe(true);

    // Segundo bootstrap (corrida/duplo clique/link vazado) → 409, NUNCA cria outro.
    const denovo = await call({
      method: 'POST',
      url: '/admin/bootstrap',
      payload: { name: 'Intruso' },
    });
    expect(denovo.statusCode).toBe(409);
    const admins = await call({ method: 'GET', url: '/admin/staff/administrador' });
    const adminsBody: { members: unknown[] } = admins.json();
    expect(adminsBody.members).toHaveLength(1); // só o primeiro
  });

  it('bootstrap exige o Bearer do Admin (nunca público)', async () => {
    const get = await app.inject({ method: 'GET', url: '/admin/bootstrap' });
    const post = await app.inject({
      method: 'POST',
      url: '/admin/bootstrap',
      payload: { name: 'X' },
    });
    expect(get.statusCode).toBe(401);
    expect(post.statusCode).toBe(401);
  });

  it('founder console — briefing e pergunta com proveniência (nunca decide)', async () => {
    const briefing = await call({ method: 'GET', url: '/admin/founder/briefing' });
    const briefingBody: { greeting: string } = briefing.json();
    expect(briefingBody.greeting.length).toBeGreaterThan(0);

    const ask = await call({
      method: 'POST',
      url: '/admin/founder/ask',
      payload: { question: 'quantos clientes temos?' },
    });
    const answer: { answer: string; provenance: string; decidesNothing: true } = ask.json();
    expect(answer.answer).toContain('1');
    expect(answer.provenance.length).toBeGreaterThan(0);
    expect(answer.decidesNothing).toBe(true);

    const empty = await call({ method: 'POST', url: '/admin/founder/ask', payload: {} });
    expect(empty.statusCode).toBe(400);
  });

  it('logs pesquisáveis + health + financeiro/campanhas sem fonte = explícito', async () => {
    const logs = await call({ method: 'GET', url: '/admin/logs?q=mission.created' });
    const body: { events: Array<{ eventType: string }> } = logs.json();
    expect(body.events.some((e) => e.eventType === 'mission.created')).toBe(true);

    const health = await call({ method: 'GET', url: '/admin/health' });
    const healthBody: { components: unknown[] } = health.json();
    expect(healthBody.components).toBeDefined();

    const finance = await call({ method: 'GET', url: '/admin/finance' });
    const financeBody: { available: boolean } = finance.json();
    expect(financeBody.available).toBe(false);
    const campaigns = await call({ method: 'GET', url: '/admin/campaigns' });
    const campaignsBody: { available: boolean } = campaigns.json();
    expect(campaignsBody.available).toBe(false);
  });

  it('BL-2.1 — sem Authorization ⇒ 401 (rota /admin/* protegida)', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/dashboard' });
    expect(res.statusCode).toBe(401);
  });

  it('BL-2.1 — Bearer inválido ⇒ 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/dashboard',
      headers: { authorization: 'Bearer ERRADO' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('BL-2.1 — OPTIONS (preflight) não é bloqueado pela auth', async () => {
    const res = await app.inject({ method: 'OPTIONS', url: '/admin/dashboard' });
    expect(res.statusCode).not.toBe(401);
  });
});
