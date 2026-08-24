// ─────────────────────────────────────────────────────────────────────────────
// CACHE DE RESPOSTA GET (2026-08-24) — prova o regime que tirou o painel do
// spinner: fresco sai do cache sem rodar o handler; vencido sai NA HORA e a
// recomputação corre por trás; ação invalida; binário e rota viva nunca entram;
// e o Bearer continua mandando (401 antes do cache).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { requireBearer } from '../auth/bearer-guard.js';
import {
  instalarCacheDeResposta,
  urlCacheavel,
  type CacheDeResposta,
} from './cache-de-resposta.js';

const SEGREDO = 'TEST-SECRET';
const AUTH = { authorization: `Bearer ${SEGREDO}` };

interface Bancada {
  app: FastifyInstance;
  cache: CacheDeResposta;
  /** Quantas vezes o handler LENTO realmente rodou. */
  execucoes: () => number;
  avancar: (ms: number) => void;
}

function bancada(): Bancada {
  const app = Fastify({ logger: false });
  requireBearer(app, { secret: SEGREDO, protect: (p) => p.startsWith('/admin/') });
  let t = 0;
  const cache = instalarCacheDeResposta(app, {
    ttlMs: 1_000,
    maxIdadeMs: 10_000,
    agora: () => t,
  });
  let n = 0;
  app.get('/admin/lento', () => {
    n += 1;
    return { execucao: n };
  });
  // URL cacheável de propósito — prova que o CONTENT-TYPE segura o que a lista
  // de URLs não pegar: só JSON entra.
  app.get('/admin/relatorio-csv', (_req, reply) =>
    reply.header('content-type', 'text/csv').send('a;b\n'),
  );
  app.post('/admin/acao', () => ({ ok: true }));
  return { app, cache, execucoes: () => n, avancar: (ms) => (t += ms) };
}

/** Espera o requente em segundo plano (inject interno) assentar. */
const assentar = (): Promise<void> => new Promise((r) => setTimeout(r, 25));

describe('cache de resposta GET do Admin', () => {
  it('fresco: a segunda leitura sai do cache sem rodar o handler', async () => {
    const b = bancada();
    const r1 = await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    const r2 = await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    expect(r1.json()).toEqual({ execucao: 1 });
    expect(r2.json()).toEqual({ execucao: 1 });
    expect(r2.headers['x-cache']).toBe('fresco');
    expect(b.execucoes()).toBe(1);
  });

  it('vencido: sai NA HORA (valor velho) e a recomputação corre por trás', async () => {
    const b = bancada();
    await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    b.avancar(2_000); // passou do TTL, dentro da idade máxima
    const velho = await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    expect(velho.json()).toEqual({ execucao: 1 }); // ninguém esperou a varredura
    expect(velho.headers['x-cache']).toBe('requentado');
    await assentar();
    const novo = await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    expect(novo.json()).toEqual({ execucao: 2 }); // o requente assentou
  });

  it('idade máxima estourada: a leitura volta a ser fria (nunca serve fóssil)', async () => {
    const b = bancada();
    await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    b.avancar(60_000);
    const r = await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    expect(r.json()).toEqual({ execucao: 2 });
    expect(r.headers['x-cache']).toBeUndefined();
  });

  it('invalidar: a ação do painel derruba o cache e a leitura seguinte recomputa', async () => {
    const b = bancada();
    await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    b.cache.invalidar();
    const r = await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    expect(r.json()).toEqual({ execucao: 2 });
  });

  it('invalidar por prefixo derruba SÓ as URLs do prefixo', async () => {
    const b = bancada();
    await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    b.cache.invalidar('/admin/juridico/');
    const r = await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    expect(r.json()).toEqual({ execucao: 1 }); // intacto: o prefixo não casa
  });

  it('resposta que não é JSON nunca entra no cache, mesmo em URL cacheável', async () => {
    const b = bancada();
    const r1 = await b.app.inject({ method: 'GET', url: '/admin/relatorio-csv', headers: AUTH });
    const r2 = await b.app.inject({ method: 'GET', url: '/admin/relatorio-csv', headers: AUTH });
    expect(r1.body).toBe('a;b\n');
    expect(r2.headers['x-cache']).toBeUndefined();
  });

  it('sem Bearer: 401 antes de o cache ser consultado — nada vaza', async () => {
    const b = bancada();
    await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH }); // cache cheio
    const r = await b.app.inject({ method: 'GET', url: '/admin/lento' });
    expect(r.statusCode).toBe(401);
    expect(r.body).not.toContain('execucao');
  });

  it('acerto de cache não renova o carimbo (o valor vence de verdade)', async () => {
    const b = bancada();
    await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    b.avancar(900);
    await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH }); // fresco
    b.avancar(200); // 1.1s desde a gravação — venceu, MESMO com o acerto no meio
    const r = await b.app.inject({ method: 'GET', url: '/admin/lento', headers: AUTH });
    expect(r.headers['x-cache']).toBe('requentado');
    await assentar();
  });
});

describe('urlCacheavel — o que NUNCA entra', () => {
  it.each([
    '/admin/humanizado/clientes', // mesa em tempo real (memo próprio)
    '/admin/humanizado/chat/553199@c.us', // conversa da secretária
    '/admin/clients/553199@c.us', // detalhe por cliente (cache por chave próprio)
    '/admin/logs',
    '/admin/health',
    '/admin/config',
    '/admin/whatsapp/status',
    '/admin/pericia-digital/casos/caso-1', // resposta varia pelo papel (LGPD)
    '/admin/documents/abc/content', // binário
    '/admin/humanizado/chat/x/anexo/y',
    '/admin/jornada/pericia/pacotes-zip?ids=a,b',
    '/admin/jornada/pericia/planilha-geral',
    '/webhook/meta', // fora do /admin
  ])('%s fica fora', (url) => {
    expect(urlCacheavel(url)).toBe(false);
  });

  it.each([
    '/admin/command-center',
    '/admin/jornada/clientes?fila=venda',
    '/admin/creditos-advogado/auditoria',
    '/admin/juridico/dashboard',
    '/admin/mapa-clientes',
  ])('%s entra', (url) => {
    expect(urlCacheavel(url)).toBe(true);
  });
});
