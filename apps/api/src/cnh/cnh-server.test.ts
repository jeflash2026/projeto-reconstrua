// ─────────────────────────────────────────────────────────────────────────────
// CNH SERVER — as portas do serviço: verificação e webhook da Meta (com token),
// repasse da API do Reconstrua (com segredo), número de outro serviço ignorado,
// painel só com Bearer, mídia só da conversa do próprio lead.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { AtendimentoCnh, InMemoryJsonStore } from '@reconstrua/infrastructure';
import { buildCnhServer } from './cnh-server.js';

const ENV = {
  CNH_META_VERIFY_TOKEN: 'verifica',
  CNH_ENCAMINHAMENTO_SEGREDO: 'repasse',
  CNH_API_TOKEN: 'painel',
};

function montar(): { app: ReturnType<typeof buildCnhServer>; enviadas: string[] } {
  const enviadas: string[] = [];
  const atendimento = new AtendimentoCnh({
    json: new InMemoryJsonStore(),
    clock: { now: () => new Date('2026-09-18T12:00:00.000Z') },
    enviar: (_chat, texto) => {
      enviadas.push(texto);
      return Promise.resolve();
    },
    enviarTemplateFollowup: null,
    completar: () =>
      Promise.resolve(
        JSON.stringify({
          mensagens: ['Olá! Aqui é o assistente virtual do escritório do Dr. Glauco Voigt.'],
          ficha: { nome: 'Maria' },
          etapa: 'recepcao',
          acao: 'conversar',
        }),
      ),
  });
  const app = buildCnhServer({
    atendimento,
    env: ENV,
    phoneNumberId: 'CNH-1',
    baixarMidia: null,
    integracoes: { whatsapp: true, ia: true, modeloFollowup: null },
    esperaRespostaMs: 0,
  });
  return { app, enviadas };
}

const payload = (phoneNumberId: string, texto: string): Record<string, unknown> => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          field: 'messages',
          value: {
            metadata: { phone_number_id: phoneNumberId },
            messages: [
              {
                from: '5511955554444',
                id: `wamid.${texto.replace(/\W/g, '')}`,
                timestamp: '1758196800',
                type: 'text',
                text: { body: texto },
              },
            ],
          },
        },
      ],
    },
  ],
});
const esperar = (): Promise<void> => new Promise((r) => setTimeout(r, 30));
const PAINEL = { authorization: 'Bearer painel' };

describe('cnh-api', () => {
  it('verificação da Meta só com o token certo', async () => {
    const { app } = montar();
    const ok = await app.inject({
      url: '/cnh-api/webhook/meta?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=123',
    });
    expect(ok.body).toBe('123');
    const errado = await app.inject({
      url: '/cnh-api/webhook/meta?hub.mode=subscribe&hub.verify_token=x&hub.challenge=123',
    });
    expect(errado.statusCode).toBe(403);
  });

  it('webhook com token: grava, a AHRI responde; sem token: 401', async () => {
    const { app, enviadas } = montar();
    const semToken = await app.inject({
      method: 'POST',
      url: '/cnh-api/webhook/meta',
      payload: payload('CNH-1', 'oi'),
    });
    expect(semToken.statusCode).toBe(401);
    const r = await app.inject({
      method: 'POST',
      url: '/cnh-api/webhook/meta?token=verifica',
      payload: payload('CNH-1', 'oi, minha cnh foi suspensa'),
    });
    expect(r.statusCode).toBe(200);
    await esperar();
    expect(enviadas).toEqual([
      'Olá! Aqui é o assistente virtual do escritório do Dr. Glauco Voigt.',
    ]);
    const leads = await app.inject({ url: '/cnh-api/admin/leads', headers: PAINEL });
    expect(leads.json<{ leads: { id: string; nome: string }[] }>().leads[0]).toMatchObject({
      id: '5511955554444',
      nome: 'Maria',
    });
  });

  it('mensagem de OUTRO número é ignorada; o repasse exige o segredo', async () => {
    const { app, enviadas } = montar();
    await app.inject({
      method: 'POST',
      url: '/cnh-api/webhook/meta?token=verifica',
      payload: payload('RECONSTRUA-1', 'oi ahri do consignado'),
    });
    await esperar();
    expect(enviadas).toHaveLength(0);
    const semSegredo = await app.inject({
      method: 'POST',
      url: '/cnh-api/webhook/encaminhado',
      payload: payload('CNH-1', 'oi'),
    });
    expect(semSegredo.statusCode).toBe(401);
    const repasse = await app.inject({
      method: 'POST',
      url: '/cnh-api/webhook/encaminhado',
      headers: { 'x-cnh-encaminhamento': 'repasse' },
      payload: payload('CNH-1', 'vim pelo repasse'),
    });
    expect(repasse.statusCode).toBe(200);
    await esperar();
    expect(enviadas).toHaveLength(1);
  });

  it('painel: sem Bearer 401; ações e mídia de outra conversa recusadas', async () => {
    const { app } = montar();
    expect((await app.inject({ url: '/cnh-api/admin/resumo' })).statusCode).toBe(401);
    expect(
      (await app.inject({ url: '/cnh-api/admin/resumo', headers: { authorization: 'Bearer x' } }))
        .statusCode,
    ).toBe(401);
    await app.inject({
      method: 'POST',
      url: '/cnh-api/webhook/meta?token=verifica',
      payload: payload('CNH-1', 'oi'),
    });
    await esperar();
    const assumir = await app.inject({
      method: 'POST',
      url: '/cnh-api/admin/leads/5511955554444/assumir',
      headers: PAINEL,
      payload: { autor: 'Jessé' },
    });
    expect(assumir.json()).toEqual({ ok: true });
    const lead = await app.inject({ url: '/cnh-api/admin/leads/5511955554444', headers: PAINEL });
    expect(lead.json<{ modo: string }>().modo).toBe('humano');
    const midia = await app.inject({
      url: '/cnh-api/admin/leads/5511955554444/midia/qualquer',
      headers: PAINEL,
    });
    expect(midia.statusCode).toBe(404);
    expect((await app.inject({ url: '/cnh-api/admin/config', headers: PAINEL })).json()).toEqual({
      whatsapp: true,
      ia: true,
      modeloFollowup: null,
    });
  });
});
