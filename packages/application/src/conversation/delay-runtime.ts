// ─────────────────────────────────────────────────────────────────────────────
// DELAY RUNTIME — a primitiva de ESPERA. Envolve o `Sleeper` (real em produção,
// virtual em teste) para que "esperar" seja injetável, testável e nunca bloqueie
// o event loop de forma incontrolada. Zero ou negativo não espera.
// ─────────────────────────────────────────────────────────────────────────────
import type { Sleeper } from './ports.js';

export class DelayRuntime {
  constructor(private readonly sleeper: Sleeper) {}

  async wait(ms: number): Promise<void> {
    if (ms <= 0) return;
    await this.sleeper.sleep(ms);
  }
}
