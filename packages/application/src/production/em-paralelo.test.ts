import { describe, it, expect } from 'vitest';
import { emParalelo } from './em-paralelo.js';

const espera = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('emParalelo', () => {
  it('preserva a ordem da entrada mesmo quando os itens terminam fora de ordem', async () => {
    const itens = [30, 1, 20, 2, 10];
    const saida = await emParalelo(itens, 5, async (ms) => {
      await espera(ms);
      return ms;
    });
    expect(saida).toEqual(itens);
  });

  it('respeita o teto de trilhas simultâneas', async () => {
    let correndo = 0;
    let pico = 0;
    await emParalelo(
      Array.from({ length: 50 }, (_, i) => i),
      4,
      async () => {
        correndo += 1;
        pico = Math.max(pico, correndo);
        await espera(1);
        correndo -= 1;
        return null;
      },
    );
    expect(pico).toBeLessThanOrEqual(4);
    expect(pico).toBeGreaterThan(1);
  });

  it('coleção vazia ⇒ saída vazia, sem chamar a função', async () => {
    let chamadas = 0;
    const saida = await emParalelo([], 8, () => {
      chamadas += 1;
      return Promise.resolve(1);
    });
    expect(saida).toEqual([]);
    expect(chamadas).toBe(0);
  });

  it('o primeiro erro propaga (mesma semântica da fila indiana)', async () => {
    await expect(
      emParalelo([1, 2, 3], 2, (n) => {
        if (n === 2) return Promise.reject(new Error('quebrou'));
        return Promise.resolve(n);
      }),
    ).rejects.toThrow('quebrou');
  });

  it('limite maior que a coleção, ou menor que 1, continua correto', async () => {
    expect(await emParalelo([1, 2], 99, (n) => Promise.resolve(n * 2))).toEqual([2, 4]);
    expect(await emParalelo([1, 2], 0, (n) => Promise.resolve(n * 2))).toEqual([2, 4]);
  });
});
