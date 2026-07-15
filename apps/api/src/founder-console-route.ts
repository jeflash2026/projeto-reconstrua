// ─────────────────────────────────────────────────────────────────────────────
// FOUNDER CONSOLE — superfície HTTP ("Pergunte qualquer coisa..."). NÃO é dashboard:
// é uma conversa. `GET /founder/briefing` a AHRI inicia; `POST /founder/ask` responde.
// Servidor próprio (não toca o webhook de 2B). Não inicia porta (o dono controla o boot).
// ─────────────────────────────────────────────────────────────────────────────
import Fastify, { type FastifyInstance } from 'fastify';
import type { Clock } from '@reconstrua/domain';
import type { FounderConsoleRuntime } from '@reconstrua/application';
import { asRecord, asString } from '@reconstrua/infrastructure';

export interface FounderConsoleServerDeps {
  readonly runtime: FounderConsoleRuntime;
  readonly clock: Clock;
}

export function buildFounderConsoleServer(deps: FounderConsoleServerDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/founder/briefing', async () => {
    return deps.runtime.briefing(null, deps.clock.now());
  });

  app.post('/founder/ask', async (request) => {
    const body = asRecord(request.body);
    const question = (body ? asString(body['question']) : null) ?? '';
    return deps.runtime.ask(question, deps.clock.now());
  });

  return app;
}
