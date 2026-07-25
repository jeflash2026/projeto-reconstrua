// ─────────────────────────────────────────────────────────────────────────────
// Fase 5 — RBAC por papel + projeção LGPD nos endpoints da Central de Perícia.
// Prova que: papel restrito recebe 403 nas mutações; leitura mascara PII para
// papéis restritos e entrega completa aos que operam; a trilha de custódia só
// vai para quem pode vê-la. Stubs mínimos (o núcleo puro é testado à parte).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import { assembleAdminOperation, FakeSleeper } from '@reconstrua/infrastructure';
import { buildAdminServer } from './admin-server.js';

const ADMIN_SECRET = 'segredo-teste-rbac';

class TestClock implements Clock {
  now(): Date {
    return new Date('2026-07-25T00:00:00.000Z');
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

const CASO = {
  id: 'caso-1',
  numeroCaso: 'PD-001',
  status: 'MINUTA_GERADA',
  dados: { nomeCliente: 'Maria José da Silva', cpf: '12345678905', numeroBeneficio: '1234567' },
  minutaVersoes: [{ versao: 1, texto: 'Cliente CPF 123.456.789-05 no benefício.' }],
  fichas: [],
  documentos: [],
};

describe('Perícia Digital — RBAC + LGPD na API', () => {
  let app: FastifyInstance;

  const inject = (
    method: 'GET' | 'POST',
    url: string,
    papel?: string,
    payload?: object,
  ): ReturnType<FastifyInstance['inject']> => {
    const headers: Record<string, string> = { authorization: `Bearer ${ADMIN_SECRET}` };
    if (papel !== undefined) headers['x-pericia-papel'] = papel;
    return app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  };

  beforeAll(() => {
    const clock = new TestClock();
    const op = assembleAdminOperation({
      clock,
      uuid: new SeqUuid(),
      sleeper: new FakeSleeper(clock),
    });
    const okCaso = (): Promise<unknown> => Promise.resolve({ ok: true, valor: CASO });
    app = buildAdminServer(op, {
      accessSecret: ADMIN_SECRET,
      periciaDigitalHabilitado: true,
      periciaDigital: {
        criarCasoDoHiscon: okCaso,
        registrarDocumento: () => Promise.resolve({ ok: true, valor: {} }),
        iniciarAnalise: okCaso,
        registrarValoresBanco: okCaso,
        registrarChecklist: okCaso,
        marcarDocumentacaoPendente: okCaso,
        registrarAchado: okCaso,
        adicionarQuesito: okCaso,
        gerarMinuta: okCaso,
        submeterRevisao: okCaso,
        solicitarAjustes: okCaso,
        aprovar: okCaso,
        assinar: okCaso,
        liberarParaAdvogado: okCaso,
      },
      periciaDigitalCasos: {
        todos: () => Promise.resolve([CASO]),
        porId: () => Promise.resolve(CASO),
      },
      periciaDigitalCustodia: {
        trilha: () => Promise.resolve([{ seq: 1, acao: 'CASO_CRIADO', usuario: 'admin' }]),
        verificar: () => Promise.resolve({ integro: true, quebrouEmSeq: null }),
      },
    });
  });

  it('visualizador NÃO cria caso (403)', async () => {
    const r = await inject('POST', '/admin/pericia-digital/casos', 'visualizador', {
      chatId: 'c',
      numeroCaso: 'X',
    });
    expect(r.statusCode).toBe(403);
  });

  it('só o perito aprova/assina; administrador recebe 403', async () => {
    expect((await inject('POST', '/admin/pericia-digital/casos/caso-1/aprovar', 'administrador')).statusCode).toBe(403);
    expect((await inject('POST', '/admin/pericia-digital/casos/caso-1/assinar', 'administrador')).statusCode).toBe(403);
    expect((await inject('POST', '/admin/pericia-digital/casos/caso-1/aprovar', 'perito', {})).statusCode).toBe(200);
  });

  it('advogado lê o caso, mas com CPF/nome mascarados e minuta redigida', async () => {
    const r = await inject('GET', '/admin/pericia-digital/casos/caso-1', 'advogado');
    expect(r.statusCode).toBe(200);
    const body: {
      caso: { dados: { cpf: string; nomeCliente: string }; minutaVersoes: { texto: string }[] };
      custodia: { trilha: unknown[] };
    } = r.json();
    expect(body.caso.dados.cpf).toBe('123.XXX.XXX-05');
    expect(body.caso.dados.nomeCliente).toBe('Maria J. D. S.');
    expect(body.caso.minutaVersoes[0]?.texto).toContain('[CPF OCULTO]');
    // Advogado não vê a trilha de custódia.
    expect(body.custodia.trilha).toHaveLength(0);
  });

  it('auditor lê dado mascarado, mas VÊ a trilha de custódia', async () => {
    const r = await inject('GET', '/admin/pericia-digital/casos/caso-1', 'auditor');
    const body: { caso: { dados: { cpf: string } }; custodia: { trilha: unknown[] } } = r.json();
    expect(body.caso.dados.cpf).toBe('123.XXX.XXX-05');
    expect(body.custodia.trilha.length).toBeGreaterThan(0);
  });

  it('administrador (default, sem header) vê o dado completo', async () => {
    const r = await inject('GET', '/admin/pericia-digital/casos/caso-1');
    const body: { caso: { dados: { cpf: string; nomeCliente: string } } } = r.json();
    expect(body.caso.dados.cpf).toBe('12345678905');
    expect(body.caso.dados.nomeCliente).toBe('Maria José da Silva');
  });
});
