// ─────────────────────────────────────────────────────────────────────────────
// Suíte de CONTRATO do Event Store — verificações que QUALQUER adapter (in-memory,
// PostgreSQL) deve satisfazer: append-only, concorrência otimista, reidratação,
// integridade (hash chain), Evento Relevante exige Fato, outbox, stress. Não é um
// arquivo de teste standalone (extensão .ts); é invocada pelos testes concretos.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { EventStore, Hasher, OutboxStore, UncommittedEvent } from '@reconstrua/application';
import {
  ConcurrencyConflictError,
  RelevantEventRequiresFactError,
  EventSourcedRepository,
  assertStreamIntegrity,
  NO_STREAM,
  atVersion,
} from '@reconstrua/application';

export interface EventStoreHarness {
  readonly eventStore: EventStore;
  readonly outbox: OutboxStore;
  readonly hasher: Hasher;
}

const STREAM = 'contract-stream';

function ev(n: number): UncommittedEvent {
  return {
    eventType: 'contract.happened',
    isRelevant: false,
    payload: { n },
    occurredAt: new Date('2026-07-14T12:00:00.000Z'),
  };
}

function relevant(n: number, factRef?: string): UncommittedEvent {
  return {
    eventType: 'contract.relevant',
    isRelevant: true,
    payload: { n },
    occurredAt: new Date('2026-07-14T12:00:00.000Z'),
    ...(factRef ? { provenance: { factRef } } : {}),
  };
}

let counter = 0;
function freshId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

/** Executa toda a suíte de contrato contra um harness recém-criado por teste. */
export function runEventStoreContract(label: string, makeHarness: () => EventStoreHarness): void {
  describe(`Event Store — contrato [${label}]`, () => {
    it('anexa e relê em ordem de versão; a versão avança', async () => {
      const { eventStore } = makeHarness();
      const id = freshId();
      const r1 = await eventStore.append(STREAM, id, NO_STREAM, [ev(1), ev(2)]);
      expect(r1.version).toBe(2);
      const r2 = await eventStore.append(STREAM, id, atVersion(2), [ev(3)]);
      expect(r2.version).toBe(3);
      const all = await eventStore.readStream(STREAM, id, 0);
      expect(all.map((e) => e.version)).toEqual([1, 2, 3]);
      expect(all.map((e) => (e.payload as { n: number }).n)).toEqual([1, 2, 3]);
      expect(await eventStore.streamVersion(STREAM, id)).toBe(3);
    });

    it('impede append-only violações lógicas: conflito no-stream e conflito exact', async () => {
      const { eventStore } = makeHarness();
      const id = freshId();
      await eventStore.append(STREAM, id, NO_STREAM, [ev(1)]);
      await expect(eventStore.append(STREAM, id, NO_STREAM, [ev(2)])).rejects.toBeInstanceOf(
        ConcurrencyConflictError,
      );
      await expect(eventStore.append(STREAM, id, atVersion(5), [ev(2)])).rejects.toBeInstanceOf(
        ConcurrencyConflictError,
      );
      await expect(eventStore.append(STREAM, id, atVersion(1), [ev(2)])).resolves.toBeDefined();
    });

    it('concorrência otimista: exatamente um vence entre appends concorrentes', async () => {
      const { eventStore } = makeHarness();
      const id = freshId();
      const results = await Promise.allSettled([
        eventStore.append(STREAM, id, NO_STREAM, [ev(1)]),
        eventStore.append(STREAM, id, NO_STREAM, [ev(1)]),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(await eventStore.streamVersion(STREAM, id)).toBe(1);
    });

    it('Evento Relevante exige Fato (E12-L09); com Fato é aceito', async () => {
      const { eventStore } = makeHarness();
      const id = freshId();
      await expect(eventStore.append(STREAM, id, NO_STREAM, [relevant(1)])).rejects.toBeInstanceOf(
        RelevantEventRequiresFactError,
      );
      await expect(
        eventStore.append(STREAM, id, NO_STREAM, [relevant(1, 'fact-1')]),
      ).resolves.toBeDefined();
    });

    it('integridade da cadeia (R9): hashes encadeados e verificáveis', async () => {
      const { eventStore, hasher } = makeHarness();
      const id = freshId();
      await eventStore.append(STREAM, id, NO_STREAM, [ev(1), ev(2), ev(3)]);
      const events = await eventStore.readStream(STREAM, id, 0);
      expect(() => assertStreamIntegrity(events, hasher)).not.toThrow();
      expect(events[0]!.previousHash).toBeNull();
      expect(events[1]!.previousHash).toBe(events[0]!.hash);
    });

    it('Transactional Outbox: eventos ficam pendentes e são marcados como publicados', async () => {
      const { eventStore, outbox } = makeHarness();
      const id = freshId();
      await eventStore.append(STREAM, id, NO_STREAM, [ev(1), ev(2)]);
      const pending = await outbox.fetchUnpublished(100);
      expect(pending.length).toBeGreaterThanOrEqual(2);
      await outbox.markPublished(pending.map((e) => e.id));
      const afterPublish = await outbox.fetchUnpublished(100);
      expect(afterPublish.map((e) => e.id)).not.toEqual(
        expect.arrayContaining(pending.map((e) => e.id)),
      );
    });

    it('reidratação genérica reconstrói o estado a partir dos eventos', async () => {
      const { eventStore } = makeHarness();
      const repo = new EventSourcedRepository<{ sum: number }>({
        streamType: STREAM,
        seed: { sum: 0 },
        fold: (s, e) => ({ sum: s.sum + Number((e.payload as { n: number }).n) }),
        eventStore,
      });
      const id = freshId();
      await repo.appendEvents(id, NO_STREAM, [ev(10), ev(20), ev(30)]);
      const loaded = await repo.load(id);
      expect(loaded?.state.sum).toBe(60);
      expect(loaded?.version).toBe(3);
    });

    it('stress: um stream com 10.000 eventos mantém ordem, versão e integridade', async () => {
      const { eventStore, hasher } = makeHarness();
      const id = freshId();
      const batch: UncommittedEvent[] = [];
      for (let i = 1; i <= 10_000; i += 1) batch.push(ev(i));
      const result = await eventStore.append(STREAM, id, NO_STREAM, batch);
      expect(result.version).toBe(10_000);
      const events = await eventStore.readStream(STREAM, id, 0);
      expect(events).toHaveLength(10_000);
      expect(events[9_999]!.version).toBe(10_000);
      expect(() => assertStreamIntegrity(events, hasher)).not.toThrow();
    });
  });
}
