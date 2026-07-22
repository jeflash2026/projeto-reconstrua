// ─────────────────────────────────────────────────────────────────────────────
// Teste HTTP do Founder Console (Fastify.inject) — briefing proativo e "Pergunte
// qualquer coisa", sem abrir porta.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import { assembleAdministration, assembleLivingMemory } from '@reconstrua/infrastructure';
import { buildFounderConsoleServer } from './founder-console-route.js';

const NOW = new Date('2026-07-14T00:00:00.000Z');
class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

function harness() {
  const clock = new TestClock();
  const living = assembleLivingMemory({ clock, uuid: new SeqUuid() });
  const admin = assembleAdministration({ memoryStore: living.memoryStore });
  return buildFounderConsoleServer({ runtime: admin.founderConsole, clock });
}

describe('Founder Console HTTP', () => {
  it('GET /founder/briefing inicia a conversa', async () => {
    const app = harness();
    const response = await app.inject({ method: 'GET', url: '/founder/briefing' });
    expect(response.statusCode).toBe(200);
    const body: { greeting: string } = response.json();
    expect(body.greeting).toContain('Jessé');
    await app.close();
  });

  it('POST /founder/ask responde de Read Models', async () => {
    const app = harness();
    const response = await app.inject({
      method: 'POST',
      url: '/founder/ask',
      payload: { question: 'quantos clientes temos?' },
    });
    expect(response.statusCode).toBe(200);
    const body: { available: boolean; decidesNothing: boolean } = response.json();
    expect(body.available).toBe(true);
    expect(body.decidesNothing).toBe(true);
    await app.close();
  });
});
