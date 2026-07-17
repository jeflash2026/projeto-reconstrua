// ─────────────────────────────────────────────────────────────────────────────
// Guard de autenticação por segredo compartilhado (Bearer), REUTILIZÁVEL por
// qualquer servidor Fastify (Admin agora; Advogado/LX na Onda 3). NÃO é framework:
// um hook onRequest que exige `Authorization: Bearer <segredo>` nas rotas
// protegidas, comparando em TEMPO CONSTANTE (node:crypto). Fail-closed: segredo
// vazio ⇒ toda rota protegida responde 401 (nunca abre por engano). OPTIONS
// (preflight CORS) passa sem auth. Não cria autenticação paralela: é o único guard.
// ─────────────────────────────────────────────────────────────────────────────
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/** Compara dois segredos em TEMPO CONSTANTE (node:crypto). Reutilizável (webhook B5.1). */
export function secretsMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Extrai o token de `Authorization: Bearer <token>`; null se ausente/malformado. */
export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers['authorization'];
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token !== undefined && token !== '' ? token : null;
}

export interface BearerGuardOptions {
  /** Segredo esperado. Vazio ⇒ fail-closed (toda rota protegida responde 401). */
  readonly secret: string;
  /** true se o path (sem querystring) deve exigir autenticação. */
  readonly protect: (path: string) => boolean;
}

/** Aplica o guard a um servidor Fastify. Não altera rotas — apenas as protege. */
export function requireBearer(app: FastifyInstance, options: BearerGuardOptions): void {
  app.addHook('onRequest', (request, reply, done) => {
    if (request.method === 'OPTIONS') {
      done();
      return;
    }
    const path = request.url.split('?')[0] ?? '';
    if (!options.protect(path)) {
      done();
      return;
    }
    const token = bearerToken(request);
    if (options.secret === '' || token === null || !secretsMatch(token, options.secret)) {
      void reply.code(401).send({ error: 'não autenticado' });
      return;
    }
    done();
  });
}
