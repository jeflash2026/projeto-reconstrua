// ─────────────────────────────────────────────────────────────────────────────
// Testes da MEMÓRIA CURTA (2026-08-04) — o envelope que impediu as varreduras
// caras de travarem o processo (login do humanizado se arrastando):
//  • dentro do TTL, a conta NÃO se repete;
//  • chamadas CONCORRENTES compartilham UMA execução (voo único);
//  • falha não é guardada; invalidar() força o recomputo;
//  • ttl 0 = sem cache (o modo dos testes de comportamento).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, afterEach } from 'vitest';
import { memoCurto } from './memo-curto.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('memoCurto', () => {
  it('dentro do TTL calcula UMA vez; vencido o TTL, recalcula', async () => {
    vi.useFakeTimers();
    let vezes = 0;
    const memo = memoCurto(() => {
      vezes += 1;
      return Promise.resolve(vezes);
    }, 1000);

    expect(await memo()).toBe(1);
    expect(await memo()).toBe(1);
    expect(vezes).toBe(1);

    vi.advanceTimersByTime(1001);
    expect(await memo()).toBe(2);
    expect(vezes).toBe(2);
  });

  it('VOO ÚNICO: chamadas concorrentes esperam a MESMA execução', async () => {
    let vezes = 0;
    let liberar = (): void => {};
    const espera = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const memo = memoCurto(async () => {
      vezes += 1;
      await espera;
      return vezes;
    }, 1000);

    const juntas = Promise.all([memo(), memo(), memo()]);
    await Promise.resolve(); // deixa as três entrarem antes de liberar
    liberar();
    expect(await juntas).toEqual([1, 1, 1]);
    expect(vezes).toBe(1); // uma varredura para as três telas
  });

  it('falha NÃO é guardada: o erro chega a quem esperava e a próxima tenta de novo', async () => {
    let vezes = 0;
    const memo = memoCurto(() => {
      vezes += 1;
      return vezes === 1 ? Promise.reject(new Error('banco fora')) : Promise.resolve('ok');
    }, 1000);

    await expect(memo()).rejects.toThrow('banco fora');
    expect(await memo()).toBe('ok');
    expect(vezes).toBe(2);
  });

  it('invalidar() descarta o guardado (a ação do painel aparece na hora)', async () => {
    let vezes = 0;
    const memo = memoCurto(() => {
      vezes += 1;
      return Promise.resolve(vezes);
    }, 60_000);

    expect(await memo()).toBe(1);
    memo.invalidar();
    expect(await memo()).toBe(2);
  });

  it('ttl 0 = SEM cache (comportamento determinístico dos testes)', async () => {
    let vezes = 0;
    const memo = memoCurto(() => {
      vezes += 1;
      return Promise.resolve(vezes);
    }, 0);

    await memo();
    await memo();
    expect(vezes).toBe(2);
  });
});
