// ─────────────────────────────────────────────────────────────────────────────
// buildServer — monta o Fastify com a rota do webhook da Evolution. NÃO inicia o
// servidor (o dono controla o boot). A rota RESPONDE RÁPIDO (ack) e processa o
// turno de forma DESTACADA — porque a resposta humana leva segundos (typing/delay)
// e o webhook não deve bloquear. Erros de processamento vão ao log.
// ─────────────────────────────────────────────────────────────────────────────
import Fastify, { type FastifyInstance } from 'fastify';
import type { ConversationRuntime } from '@reconstrua/application';
import { mapAndProcess } from './conversation-webhook.js';

export interface ServerDeps {
  readonly runtime: ConversationRuntime;
  /** Se true, aguarda o turno completo antes de responder (uso em teste). */
  readonly awaitProcessing?: boolean;
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  app.post('/webhook/evolution', async (request) => {
    const payload: unknown = request.body;

    if (deps.awaitProcessing === true) {
      const result = await mapAndProcess(deps.runtime, payload);
      return { ok: true, ...result };
    }

    // Produção: ACK imediato; o turno humano roda destacado.
    void mapAndProcess(deps.runtime, payload).catch((error: unknown) => {
      app.log.error({ error }, 'falha ao processar evento da Evolution');
    });
    return { ok: true };
  });

  return app;
}
