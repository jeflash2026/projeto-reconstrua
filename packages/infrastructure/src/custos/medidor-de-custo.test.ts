// ─────────────────────────────────────────────────────────────────────────────
// Testes do MedidorDeCusto — atribuição por turno (AsyncLocalStorage), preço por
// modelo, isolamento entre turnos PARALELOS e o medidor nunca derrubar o turno.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import { InMemoryJsonStore } from '../production/json-store.js';
import { MedidorDeCusto, precoDoModelo } from './medidor-de-custo.js';

class TestClock implements Clock {
  now(): Date {
    return new Date('2026-07-21T12:00:00.000Z');
  }
}

function makeMedidor(): { medidor: MedidorDeCusto; json: InMemoryJsonStore } {
  const json = new InMemoryJsonStore();
  return { medidor: new MedidorDeCusto({ json, clock: new TestClock() }), json };
}

describe('MedidorDeCusto', () => {
  it('conversa DENTRO de um turno é atribuída ao chatId; fora, fica sem dono', async () => {
    const { medidor } = makeMedidor();
    await medidor.noTurno('5511@s.whatsapp.net', () =>
      medidor.registrarConversa({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        tokensIn: 100,
        tokensOut: 50,
      }),
    );
    await medidor.registrarConversa({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      tokensIn: 10,
      tokensOut: 5,
    });
    const registros = await medidor.listar();
    expect(registros).toHaveLength(2);
    expect(registros.find((r) => r.chatId === '5511@s.whatsapp.net')).toBeDefined();
    expect(registros.find((r) => r.chatId === null)).toBeDefined();
  });

  it('turnos PARALELOS de chats diferentes não misturam a atribuição', async () => {
    const { medidor } = makeMedidor();
    const demora = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    await Promise.all([
      medidor.noTurno('chatA', async () => {
        await demora(15);
        await medidor.registrarConversa({
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          tokensIn: 1,
          tokensOut: 1,
        });
      }),
      medidor.noTurno('chatB', async () => {
        await demora(5);
        await medidor.registrarConversa({
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          tokensIn: 2,
          tokensOut: 2,
        });
      }),
    ]);
    const registros = await medidor.listar();
    expect(registros.find((r) => r.tokensIn === 1)?.chatId).toBe('chatA');
    expect(registros.find((r) => r.tokensIn === 2)?.chatId).toBe('chatB');
  });

  it('preço por modelo: sonnet/opus conhecidos; desconhecido ⇒ custoUsd null (tokens ficam)', async () => {
    expect(precoDoModelo('claude-sonnet-5')).toEqual({ entrada: 3, saida: 15 });
    expect(precoDoModelo('claude-opus-4-8')).toEqual({ entrada: 15, saida: 75 });
    expect(precoDoModelo('modelo-misterioso')).toBeNull();
    const { medidor } = makeMedidor();
    await medidor.registrarConversa({
      provider: 'x',
      model: 'modelo-misterioso',
      tokensIn: 1000,
      tokensOut: 1000,
    });
    const [r] = await medidor.listar();
    expect(r).toMatchObject({ custoUsd: null, tokensIn: 1000, tokensOut: 1000 });
  });

  it('leitura registra por documentId; falha do store NÃO derruba (observador silencioso)', async () => {
    const { medidor } = makeMedidor();
    await medidor.registrarLeitura({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      documentId: 'DOC-9',
      tokensIn: 30000,
      tokensOut: 16000,
    });
    const [r] = await medidor.listar();
    expect(r).toMatchObject({ contexto: 'leitura-documento', documentId: 'DOC-9' });
    // 30000/1M×$3 + 16000/1M×$15 = $0.33 — a ORDEM DE GRANDEZA de um HISCON de 13 páginas
    expect(r?.custoUsd).toBeCloseTo(0.33, 6);

    const quebrado = new MedidorDeCusto({
      json: { ...new InMemoryJsonStore(), put: () => Promise.reject(new Error('boom')) } as never,
      clock: new TestClock(),
    });
    await expect(
      quebrado.registrarConversa({
        provider: 'a',
        model: 'claude-sonnet-5',
        tokensIn: 1,
        tokensOut: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
