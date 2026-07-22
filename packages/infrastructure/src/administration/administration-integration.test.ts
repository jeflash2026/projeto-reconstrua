// ─────────────────────────────────────────────────────────────────────────────
// Integração 2D→2E — eventos de domínio (Mission Runtime) → projeção (Read Model)
// → Administration Intelligence + Founder Console + Memória Viva. Prova que os dados
// vêm SÓ dos Read Models, que nada é inventado, e que a AHRI recomenda sem decidir.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { MissionFacts, MissionUseCaseIntent } from '@reconstrua/application';
import { InMemoryEventStore } from '../event-store/in-memory-event-store.js';
import { CryptoHasher } from '../event-store/crypto-hasher.js';
import { assembleMissionRuntime } from '../mission-runtime/build-mission-runtime.js';
import { assembleLivingMemory } from '../living-memory/build-living-memory.js';
import { assembleAdministration } from './build-administration.js';

const NOW = new Date('2026-07-14T00:00:00.000Z');
const CHAT = '5511999999999@s.whatsapp.net';

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

function intent(useCase: string): MissionUseCaseIntent {
  return {
    useCase,
    references: [],
    decisor: 'AHRI',
    tipo: 'DECISAO_OPERACIONAL_AUTOMATIZADA',
    fundamento: 'RO + Canon',
    operationalRuleRef: 'RO-2D',
  };
}
function facts(): MissionFacts {
  return {
    chatId: CHAT,
    senderId: CHAT,
    messageId: 'M1',
    perceptKind: 'text',
    text: 'olá',
    mediaRef: null,
    fileName: null,
    mimeType: null,
    occurredAt: NOW,
  };
}

async function scenario() {
  const clock = new TestClock();
  const eventStore = new InMemoryEventStore(new CryptoHasher(), new SeqUuid(), clock);
  const { runtime } = assembleMissionRuntime({
    eventStore,
    hasher: new CryptoHasher(),
    uuid: new SeqUuid(),
    clock,
  });
  const living = assembleLivingMemory({ clock, uuid: new SeqUuid() });
  const admin = assembleAdministration({ memoryStore: living.memoryStore });

  // 1) A AHRI executa o onboarding (2D) → eventos de domínio.
  const result = await runtime.execute(facts(), [intent('OnboardClient')]);
  // 2) A Memória Viva ingere o turno.
  await living.ingestor.ingestTurn(
    { chatId: CHAT, messageId: 'M1', text: 'olá', perceptId: 'P1', sentiment: 'neutral', at: NOW },
    result.outcomes,
  );
  // 3) O Read Model administrativo projeta os eventos (via o subscriber).
  for (const event of await eventStore.readAll(0, 1000)) {
    await admin.projectionSubscriber.handle(event);
  }
  return { admin, living, clock };
}

describe('Administration Intelligence + Founder Console (dados só de Read Models)', () => {
  it('conta clientes e missões a partir dos eventos projetados', async () => {
    const s = await scenario();
    const clients = await s.admin.admin.answer('client_count', NOW);
    const missions = await s.admin.admin.answer('mission_count', NOW);
    expect(clients.value).toBe(1);
    expect(clients.provenance).toBe('read-model:admin-metrics');
    expect(missions.value).toBe(1);
  });

  it('NUNCA inventa: dados não capturados retornam não disponível', async () => {
    const s = await scenario();
    for (const kind of [
      'financial_under_administration',
      'roi',
      'best_campaign',
      'lawyer_most_processes',
    ] as const) {
      const answer = await s.admin.admin.answer(kind, NOW);
      expect(answer.available).toBe(false);
      expect(answer.value).toBeNull();
    }
  });

  it('roteia perguntas em linguagem para as métricas certas', async () => {
    const s = await scenario();
    expect(s.admin.admin.route('AHRI, quantos clientes temos?')).toBe('client_count');
    expect(s.admin.admin.route('Existe algum gargalo?')).toBe('bottlenecks');
    expect(s.admin.admin.route('Qual o ROI atual?')).toBe('roi');
    expect(s.admin.admin.route('qual a cor do céu?')).toBeNull();
  });

  it('Founder Console: briefing proativo com deltas narrados', async () => {
    const s = await scenario();
    const briefing = await s.admin.founderConsole.briefing(null, NOW);
    expect(briefing.newClients).toBe(1);
    expect(briefing.newMissions).toBe(1);
    expect(briefing.greeting).toContain('Jessé');
    expect(briefing.greeting).toContain('Posso mostrar os detalhes');
  });

  it('Founder Console: responde "quantos clientes" e recusa inventar "honorários"', async () => {
    const s = await scenario();
    const clients = await s.admin.founderConsole.ask('quantos clientes temos?', NOW);
    expect(clients.available).toBe(true);
    expect(clients.decidesNothing).toBe(true);

    const money = await s.admin.founderConsole.ask('quanto temos em honorários previstos?', NOW);
    expect(money.available).toBe(false);
    expect(money.answer).toContain('não vou inventar');
  });

  it('Founder Console: RECOMENDA com fundamento, mas NUNCA decide', async () => {
    const s = await scenario();
    const rec = await s.admin.founderConsole.ask('Qual seria sua recomendação operacional?', NOW);
    expect(rec.isRecommendation).toBe(true);
    expect(rec.decidesNothing).toBe(true);
    expect(rec.answer).toContain('a decisão é sua');
  });
});
