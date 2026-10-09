// ─────────────────────────────────────────────────────────────────────────────
// AVISO DO NÚMERO DA EQUIPE (pedido do dono, 2026-10-09).
//
// A Layara chama do número dela e parte dos clientes nunca responde — para quem
// tem 60+ e ouve falar de golpe todo dia, número desconhecido é motivo para
// ignorar. O botão manda a AHRI avalizar aquele número.
//
// O que estes testes travam é a REGRA DE ALCANCE, que é onde o estrago moraria:
// o aviso sai SÓ para quem recebeu a documentação e não voltou. Quem está
// conversando com a equipe agora, quem não está esperando devolução e quem já
// entregou tudo não podem receber — seriam mensagens inúteis numa conta que a
// Meta já bloqueou uma vez. E nada sai sem a confirmação explícita.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import {
  assembleAdminOperation,
  FakeSleeper,
  type AssembledAdminOperation,
} from '@reconstrua/infrastructure';
import { buildAdminServer } from './admin-server.js';

const ADMIN_SECRET = 'segredo-de-teste';
const AGORA = new Date('2026-10-09T12:00:00.000Z');
const HORA = 60 * 60 * 1000;

class TestClock implements Clock {
  now(): Date {
    return new Date(AGORA.getTime());
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

const docs = (tudo: boolean) => ({
  procuracao: tudo,
  rg: tudo,
  comprovante: tudo,
  extratoCredito: tudo,
});

/** A mesa do teste: um cliente para cada situação que a regra precisa separar. */
const MESA = [
  {
    // ALVO: a equipe mandou a documentação e ele sumiu.
    chatId: 'sem-retorno@s.whatsapp.net',
    nome: 'MARIA DAS DORES SOUZA',
    telefone: '5516900000001',
    uf: 'SP',
    docs: docs(false),
    completo: false,
    descartado: false,
    aguardandoAssinatura: true,
    aguardandoDesde: new Date(AGORA.getTime() - 5 * 24 * HORA).toISOString(),
  },
  {
    // NÃO: respondeu há pouco — a secretária está no caso agora.
    chatId: 'conversando@s.whatsapp.net',
    nome: 'JOAO PEREIRA',
    telefone: '5516900000002',
    uf: 'SP',
    docs: docs(false),
    completo: false,
    descartado: false,
    aguardandoAssinatura: true,
    aguardandoDesde: new Date(AGORA.getTime() - 5 * 24 * HORA).toISOString(),
  },
  {
    // NÃO: ninguém mandou documentação para ele ainda — não há o que avalizar.
    chatId: 'sem-envio@s.whatsapp.net',
    nome: 'ANA LIMA',
    telefone: '5516900000003',
    uf: 'MG',
    docs: docs(false),
    completo: false,
    descartado: false,
    aguardandoAssinatura: false,
    aguardandoDesde: null,
  },
  {
    // NÃO: já entregou tudo.
    chatId: 'completo@s.whatsapp.net',
    nome: 'CARLOS ALVES',
    telefone: '5516900000004',
    uf: 'SP',
    docs: docs(true),
    completo: true,
    descartado: false,
    aguardandoAssinatura: true,
    aguardandoDesde: new Date(AGORA.getTime() - 5 * 24 * HORA).toISOString(),
  },
];

describe('POST /admin/humanizado/aviso-equipe', () => {
  let app: FastifyInstance;
  const enviados: { chatId: string; template: string; vars: readonly string[] }[] = [];

  beforeAll(() => {
    const clock = new TestClock();
    const op: AssembledAdminOperation = assembleAdminOperation({
      clock,
      uuid: new SeqUuid(),
      sleeper: new FakeSleeper(clock),
    });
    app = buildAdminServer(op, {
      accessSecret: ADMIN_SECRET,
      humanizado: { clientes: () => Promise.resolve(MESA) },
      chatHumanizado: {
        // Só o "conversando" falou nas últimas 24h.
        resumo: () =>
          Promise.resolve([
            {
              chatId: 'conversando@s.whatsapp.net',
              ultimaEntradaEm: new Date(AGORA.getTime() - 2 * HORA).toISOString(),
            },
          ]),
        listar: () => Promise.resolve({ mensagens: [] }),
        enviarTemplate: (
          chatId: string,
          template: string,
          _autor: string,
          vars: readonly string[],
        ) => {
          enviados.push({ chatId, template, vars });
          return Promise.resolve({ ok: true });
        },
      },
    } as unknown as Parameters<typeof buildAdminServer>[1]);
  });

  const chamar = (payload: object) =>
    app.inject({
      method: 'POST',
      url: '/admin/humanizado/aviso-equipe',
      payload,
      headers: { authorization: `Bearer ${ADMIN_SECRET}` },
    });

  it('sem confirmação explícita ⇒ 400 e nada sai', async () => {
    const res = await chamar({ uf: 'SP' });
    expect(res.statusCode).toBe(400);
    expect(enviados).toHaveLength(0);
  });

  it('alcança SÓ quem recebeu a documentação e não respondeu', async () => {
    const res = await chamar({ confirmar: true, limite: 50 });
    expect(res.statusCode).toBe(200);
    const corpo: { enviados: number; alvos: number } = res.json();
    expect(corpo.enviados).toBe(1);
    expect(corpo.alvos).toBe(1);

    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.chatId).toBe('sem-retorno@s.whatsapp.net');
    // O template é o do aviso — nunca a cobrança de documentos.
    expect(enviados[0]?.template).toBe('contato_layara');
    // Vai o PRIMEIRO nome: "Olá, Maria!", não o nome completo em caixa alta.
    expect(enviados[0]?.vars).toEqual(['Maria']);
  });
});
