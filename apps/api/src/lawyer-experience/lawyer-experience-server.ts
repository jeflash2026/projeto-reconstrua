// ─────────────────────────────────────────────────────────────────────────────
// buildLawyerExperienceServer — a API do Sprint 3D (o advogado nunca começa do
// zero). Complementa a API 3B (congelada, intocada). Rotas: plantão, quadro do
// processo, decisões (parar/aguardar/resolver), métricas e a preparação noturna
// (cron do dono). Isolamento idêntico ao 3B: x-advogado-id de advogado ATIVO.
// ─────────────────────────────────────────────────────────────────────────────
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { AssembledLawyerExperience } from '@reconstrua/infrastructure';

export function buildLawyerExperienceServer(lx: AssembledLawyerExperience): FastifyInstance {
  const app = Fastify({ logger: false });

  app.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('access-control-allow-origin', '*');
    reply.header('access-control-allow-methods', 'GET,POST,OPTIONS');
    reply.header('access-control-allow-headers', 'content-type,x-advogado-id');
    done();
  });
  app.options('/*', (_request, reply) => {
    void reply.code(204).send();
  });

  async function advogadoOf(request: FastifyRequest): Promise<string | null> {
    const id = request.headers['x-advogado-id'];
    if (typeof id !== 'string' || id.trim() === '') return null;
    const members = await lx.op.staff.list('advogado');
    const member = members.find((m) => m.id === id);
    return member && member.active ? member.id : null;
  }

  // ── O QUADRO DE PLANTÃO ──────────────────────────────────────────────────────
  app.get('/lx/plantao', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    return lx.plantao.plantao(advogadoId);
  });

  // ── O QUADRO DO PROCESSO (marca visto no cursor) ─────────────────────────────
  app.get('/lx/processos/:missionId/quadro', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    const { missionId } = request.params as { missionId: string };
    const quadro = await lx.plantao.quadro(advogadoId, missionId);
    if (!quadro) return reply.code(403).send({ error: 'processo não atribuído a este advogado' });
    return quadro;
  });

  // ── DECISÕES: a AHRI parou e aguarda ─────────────────────────────────────────
  app.get('/lx/decisoes', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    return lx.gate.awaiting(advogadoId);
  });

  app.post('/lx/decisoes/:decisionId/resolver', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    const { decisionId } = request.params as { decisionId: string };
    const body = request.body as { accepted?: boolean; note?: string };
    if (typeof body.accepted !== 'boolean') {
      return reply.code(400).send({ error: 'accepted (boolean) é obrigatório' });
    }
    try {
      return await lx.afterDecision.resolve(advogadoId, decisionId, body.accepted, body.note ?? null);
    } catch (error) {
      return reply.code(403).send({ error: error instanceof Error ? error.message : 'não permitido' });
    }
  });

  // ── MÉTRICAS DE PRODUTIVIDADE ────────────────────────────────────────────────
  app.get('/lx/metricas', async (request, reply) => {
    const advogadoId = await advogadoOf(request);
    if (!advogadoId) return reply.code(401).send({ error: 'advogado não identificado ou inativo' });
    return lx.productivity.report(advogadoId);
  });

  // ── PREPARAÇÃO NOTURNA (cron do dono) ────────────────────────────────────────
  app.post('/lx-admin/night-shift', async () => lx.nightShift.run(new Date()));

  return app;
}
