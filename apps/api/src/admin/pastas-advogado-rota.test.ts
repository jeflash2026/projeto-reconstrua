// ─────────────────────────────────────────────────────────────────────────────
// PASTAS POR ADVOGADO — a rota não pode varrer a base (2026-10-13).
//
// A tela do Portal Jurídico mostrava "Pastas por advogado indisponíveis agora".
// Causa medida em produção: a rota compunha o ALIR de TODOS os clientes
// (23,8 s) só para montar o mapa de nomes, e o portal desiste em 20 s. O nome
// só é necessário para os chats ENTREGUES a um advogado — dezenas, não a base.
//
// O teste trava a regra pelo CUSTO, não pela saída: list() (a base inteira) não
// pode ser chamada quando as atribuições já trazem o chatId. Sem isso, a
// próxima pessoa que mexer aqui reintroduz a varredura sem perceber.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import {
  assembleAdminOperation,
  FakeSleeper,
  type AssembledAdminOperation,
} from '@reconstrua/infrastructure';
import { buildAdminServer } from './admin-server.js';

const ADMIN_SECRET = 'segredo-de-teste';
const AGORA = new Date('2026-10-13T12:00:00.000Z');

class TestClock implements Clock {
  private t = new Date(AGORA.getTime());
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

const CHAT_A = '5516900000001@s.whatsapp.net';
const CHAT_B = '5516900000002@s.whatsapp.net';

describe('GET /admin/juridico/pastas', () => {
  /** Monta a rota com um ClientesList espião: conta list() e porChat(). */
  function bancada(comChatIdNaAtribuicao: boolean) {
    const clock = new TestClock();
    const op: AssembledAdminOperation = assembleAdminOperation({
      clock,
      uuid: new SeqUuid(),
      sleeper: new FakeSleeper(clock),
    });
    let listas = 0;
    const porChatPedidos: string[] = [];
    const espiao = {
      ...op,
      staff: {
        list: () => Promise.resolve([{ id: 'adv-1', name: 'Dra. Gracielly' }]),
      },
      work: {
        myMissions: () =>
          Promise.resolve([
            {
              missionId: 'm-1',
              ...(comChatIdNaAtribuicao ? { chatId: CHAT_A } : {}),
              assignedAt: AGORA,
            },
          ]),
      },
      clientes: {
        list: () => {
          listas += 1;
          return Promise.resolve([
            { chatId: CHAT_A, missionId: 'm-1', quem: 'MARIA DAS DORES', clienteId: 'c-1' },
            { chatId: CHAT_B, missionId: 'm-2', quem: 'JOAO PEREIRA', clienteId: 'c-2' },
          ]);
        },
        porChat: (chatId: string) => {
          porChatPedidos.push(chatId);
          return Promise.resolve(
            chatId === CHAT_A ? { chatId, quem: 'MARIA DAS DORES', clienteId: 'c-1' } : null,
          );
        },
      },
    } as unknown as AssembledAdminOperation;

    const app = buildAdminServer(espiao, {
      accessSecret: ADMIN_SECRET,
      juridico: {
        listarClientes: () => Promise.resolve([]),
        listarContratos: () => Promise.resolve([]),
      },
    } as unknown as Parameters<typeof buildAdminServer>[1]);
    return { app, contarListas: () => listas, porChatPedidos };
  }

  const chamar = (app: ReturnType<typeof bancada>['app']) =>
    app.inject({
      method: 'GET',
      url: '/admin/juridico/pastas',
      headers: { authorization: `Bearer ${ADMIN_SECRET}` },
    });

  it('atribuição com chatId ⇒ resolve só os entregues e NUNCA lista a base', async () => {
    const b = bancada(true);
    const res = await chamar(b.app);
    expect(res.statusCode).toBe(200);
    const corpo: { pastas: { advogado: string; clientes: { nome: string }[] }[] } = res.json();
    expect(corpo.pastas[0]?.advogado).toBe('Dra. Gracielly');
    expect(corpo.pastas[0]?.clientes[0]?.nome).toBe('MARIA DAS DORES');
    // O ponto do teste: a base inteira não foi composta.
    expect(b.contarListas()).toBe(0);
    // E só o chat ENTREGUE custou um ALIR — o outro cliente da base, não.
    expect(b.porChatPedidos).toEqual([CHAT_A]);
  });

  it('atribuição ANTIGA sem chatId ⇒ aí sim varre, para não perder a entrega', async () => {
    const b = bancada(false);
    const res = await chamar(b.app);
    expect(res.statusCode).toBe(200);
    const corpo: { pastas: { clientes: { nome: string; chatId: string }[] }[] } = res.json();
    expect(corpo.pastas[0]?.clientes[0]?.chatId).toBe(CHAT_A);
    expect(b.contarListas()).toBe(1);
  });
});
