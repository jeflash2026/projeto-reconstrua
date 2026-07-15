// ─────────────────────────────────────────────────────────────────────────────
// Sleeper — implementações do port de espera. `SystemSleeper` espera de verdade
// (setTimeout). `FakeSleeper` NÃO espera: registra as durações pedidas (para os
// testes asseverarem o timing sem gastar tempo real) e opcionalmente avança um
// relógio de teste, simulando a passagem do tempo.
// ─────────────────────────────────────────────────────────────────────────────
import type { Sleeper } from '@reconstrua/application';

export class SystemSleeper implements Sleeper {
  sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

export interface AdvanceableClock {
  advance(ms: number): void;
}

export class FakeSleeper implements Sleeper {
  private readonly recorded: number[] = [];

  constructor(private readonly clock?: AdvanceableClock) {}

  sleep(ms: number): Promise<void> {
    this.recorded.push(ms);
    this.clock?.advance(ms);
    return Promise.resolve();
  }

  /** Todas as durações de espera pedidas, na ordem. */
  sleeps(): readonly number[] {
    return [...this.recorded];
  }

  total(): number {
    return this.recorded.reduce((sum, ms) => sum + ms, 0);
  }
}
