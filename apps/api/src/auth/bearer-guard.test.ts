// ─────────────────────────────────────────────────────────────────────────────
// Testes do guard de autenticação (BL-2.1 / DF-12). Prova: rota protegida sem
// token ⇒ 401; token correto ⇒ 200; token errado ⇒ 401; rota não protegida passa;
// segredo vazio ⇒ fail-closed; OPTIONS não é bloqueado; parser de Bearer.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { requireBearer, bearerToken } from './bearer-guard.js';

function appWith(secret: string) {
  const app = Fastify({ logger: false });
  requireBearer(app, { secret, protect: (p) => p.startsWith('/admin/') });
  app.get('/admin/x', () => ({ ok: true }));
  app.get('/publico', () => ({ ok: true }));
  return app;
}

describe('requireBearer — guard de autenticação reutilizável (DF-12)', () => {
  it('rota protegida sem token ⇒ 401', async () => {
    const res = await appWith('S1').inject({ method: 'GET', url: '/admin/x' });
    expect(res.statusCode).toBe(401);
  });

  it('token correto ⇒ 200', async () => {
    const res = await appWith('S1').inject({
      method: 'GET',
      url: '/admin/x',
      headers: { authorization: 'Bearer S1' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('token errado ⇒ 401', async () => {
    const res = await appWith('S1').inject({
      method: 'GET',
      url: '/admin/x',
      headers: { authorization: 'Bearer NAO' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rota não protegida passa sem token', async () => {
    const res = await appWith('S1').inject({ method: 'GET', url: '/publico' });
    expect(res.statusCode).toBe(200);
  });

  it('segredo vazio ⇒ fail-closed (401 mesmo com token)', async () => {
    const res = await appWith('').inject({
      method: 'GET',
      url: '/admin/x',
      headers: { authorization: 'Bearer qualquer' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('OPTIONS (preflight) não é bloqueado pela auth', async () => {
    const res = await appWith('S1').inject({ method: 'OPTIONS', url: '/admin/x' });
    expect(res.statusCode).not.toBe(401);
  });

  it('bearerToken extrai o token e rejeita malformados', () => {
    const req = (authorization?: string): FastifyRequest =>
      ({
        headers: authorization === undefined ? {} : { authorization },
      }) as unknown as FastifyRequest;
    expect(bearerToken(req('Bearer abc'))).toBe('abc');
    expect(bearerToken(req('bearer  xyz '))).toBe('xyz');
    expect(bearerToken(req('Basic zzz'))).toBeNull();
    expect(bearerToken(req())).toBeNull();
  });
});
