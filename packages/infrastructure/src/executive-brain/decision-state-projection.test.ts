// ─────────────────────────────────────────────────────────────────────────────
// Testes do DecisionStateProjectionSubscriber + store (RFC-0035-G). Provam:
// truth.synthesized → truthEstablished (chaveado por missionId), idempotência,
// que eventos de contrato vazio NÃO são consumidos (nada inventado) e que evento
// sem missionId é ignorado.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { StoredEvent, StoredProvenance } from '@reconstrua/application';
import { InMemoryDecisionStateStore } from './decision-state-read-model.js';
import { DecisionStateProjectionSubscriber } from './decision-state-projection-subscriber.js';

const NO_PROV: StoredProvenance = { factRef: null, actor: null, decisionType: null, fundamento: null, operationalRuleRef: null };

function evt(over: Partial<StoredEvent>): StoredEvent {
  return {
    id: 'E1',
    streamType: 'operational-truth',
    streamId: 'T1',
    version: 1,
    eventType: 'operational-truth.synthesized',
    isRelevant: true,
    payload: { missionId: 'M1' },
    provenance: NO_PROV,
    previousHash: null,
    hash: 'h',
    occurredAt: new Date('2026-07-16T00:00:00.000Z'),
    recordedAt: new Date('2026-07-16T00:00:00.000Z'),
    globalSeq: 1,
    ...over,
  };
}

describe('DecisionStateProjectionSubscriber (RFC-0035-G)', () => {
  it('operational-truth.synthesized ⇒ truthEstablished true, por payload.missionId', async () => {
    const store = new InMemoryDecisionStateStore();
    await new DecisionStateProjectionSubscriber(store).handle(evt({}));
    expect(await store.load('M1')).toMatchObject({ missionId: 'M1', truthEstablished: true });
  });

  it('idempotente: segundo evento não regride nem reescreve o updatedAt', async () => {
    const store = new InMemoryDecisionStateStore();
    const sub = new DecisionStateProjectionSubscriber(store);
    await sub.handle(evt({}));
    await sub.handle(evt({ id: 'E2', recordedAt: new Date('2026-07-17T00:00:00.000Z') }));
    const rec = await store.load('M1');
    expect(rec?.truthEstablished).toBe(true);
    expect(rec?.updatedAt.toISOString()).toBe('2026-07-16T00:00:00.000Z'); // manteve o primeiro
  });

  it('operational-state.derived SEM terminalState (derivação normal) NÃO é consumido', async () => {
    const store = new InMemoryDecisionStateStore();
    await new DecisionStateProjectionSubscriber(store).handle(
      evt({ eventType: 'operational-state.derived', streamType: 'operational-state' }),
    );
    expect(await store.load('M1')).toBeNull();
  });

  it('sem missionId ⇒ ignora', async () => {
    const store = new InMemoryDecisionStateStore();
    await new DecisionStateProjectionSubscriber(store).handle(evt({ payload: {} }));
    expect(await store.load('M1')).toBeNull();
  });
});

describe('DecisionStateProjectionSubscriber · B4.1 encerramento (terminalState)', () => {
  const closeEvt = (over: Partial<StoredEvent> = {}): StoredEvent =>
    evt({
      eventType: 'operational-state.derived',
      streamType: 'operational-state',
      payload: { missionId: 'M1', terminalState: 'ENCERRADA', reason: 'encerramento operacional' },
      ...over,
    });

  it('operational-state.derived com terminalState=ENCERRADA ⇒ terminalState projetado', async () => {
    const store = new InMemoryDecisionStateStore();
    await new DecisionStateProjectionSubscriber(store).handle(closeEvt());
    expect(await store.load('M1')).toMatchObject({ missionId: 'M1', terminalState: 'ENCERRADA' });
  });

  it('encerramento é idempotente (segundo evento não altera o registro)', async () => {
    const store = new InMemoryDecisionStateStore();
    const sub = new DecisionStateProjectionSubscriber(store);
    await sub.handle(closeEvt());
    await sub.handle(closeEvt({ id: 'E2', recordedAt: new Date('2026-07-18T00:00:00.000Z') }));
    const rec = await store.load('M1');
    expect(rec?.terminalState).toBe('ENCERRADA');
    expect(rec?.updatedAt.toISOString()).toBe('2026-07-16T00:00:00.000Z'); // manteve o primeiro
  });

  it('encerrar preserva a Verdade já estabelecida; e a Verdade posterior não regride o encerramento', async () => {
    const store = new InMemoryDecisionStateStore();
    const sub = new DecisionStateProjectionSubscriber(store);
    await sub.handle(evt({})); // truth.synthesized → truthEstablished
    await sub.handle(closeEvt()); // encerra
    expect(await store.load('M1')).toMatchObject({ truthEstablished: true, terminalState: 'ENCERRADA' });

    // Uma nova Verdade (evento tardio) NÃO limpa a terminalidade (sticky).
    const store2 = new InMemoryDecisionStateStore();
    const sub2 = new DecisionStateProjectionSubscriber(store2);
    await sub2.handle(closeEvt()); // encerra primeiro
    // truth com missionId novo não idempotente porque truthEstablished era default; força re-save
    await store2.save({ missionId: 'M1', truthEstablished: false, terminalState: 'ENCERRADA', updatedAt: new Date('2026-07-16T00:00:00.000Z') });
    await sub2.handle(evt({ id: 'E9' }));
    expect(await store2.load('M1')).toMatchObject({ truthEstablished: true, terminalState: 'ENCERRADA' });
  });

  it('derivação normal (sem terminalState) após encerramento NÃO reabre a missão', async () => {
    const store = new InMemoryDecisionStateStore();
    const sub = new DecisionStateProjectionSubscriber(store);
    await sub.handle(closeEvt());
    await sub.handle(evt({ eventType: 'operational-state.derived', streamType: 'operational-state', payload: { missionId: 'M1' } }));
    expect(await store.load('M1')).toMatchObject({ terminalState: 'ENCERRADA' });
  });
});

describe('DecisionStateProjectionSubscriber · B4.3 reabertura (reopened)', () => {
  const closeEvt = (): StoredEvent =>
    evt({ eventType: 'operational-state.derived', streamType: 'operational-state', payload: { missionId: 'M1', terminalState: 'ENCERRADA' } });
  const reopenEvt = (over: Partial<StoredEvent> = {}): StoredEvent =>
    evt({ eventType: 'operational-state.derived', streamType: 'operational-state', payload: { missionId: 'M1', reopened: true }, ...over });

  it('reabertura EXPLÍCITA (reopened:true) LIMPA a terminalidade (ENCERRADA → em curso)', async () => {
    const store = new InMemoryDecisionStateStore();
    const sub = new DecisionStateProjectionSubscriber(store);
    await sub.handle(closeEvt());
    expect(await store.load('M1')).toMatchObject({ terminalState: 'ENCERRADA' });
    await sub.handle(reopenEvt({ id: 'E2', recordedAt: new Date('2026-07-20T00:00:00.000Z') }));
    const rec = await store.load('M1');
    expect(rec?.terminalState).toBeNull();
    expect(rec?.truthEstablished).toBe(true); // Verdade preservada
  });

  it('reabertura é idempotente e não afeta missão já em curso', async () => {
    const store = new InMemoryDecisionStateStore();
    const sub = new DecisionStateProjectionSubscriber(store);
    await sub.handle(reopenEvt()); // missão inexistente/em curso
    expect(await store.load('M1')).toBeNull(); // nada a limpar ⇒ não inventa registro
    await sub.handle(closeEvt());
    await sub.handle(reopenEvt({ id: 'E2' }));
    await sub.handle(reopenEvt({ id: 'E3' })); // segunda reabertura: no-op
    expect(await store.load('M1')).toMatchObject({ terminalState: null });
  });

  it('B4.4 — all() devolve todos os registros para as métricas operacionais', async () => {
    const store = new InMemoryDecisionStateStore();
    const sub = new DecisionStateProjectionSubscriber(store);
    await sub.handle(evt({ payload: { missionId: 'M1' } }));
    await sub.handle(evt({ id: 'E2', payload: { missionId: 'M2' } }));
    await sub.handle(closeEvt()); // encerra M1
    const all = await store.all();
    expect(all).toHaveLength(2);
    expect(all.filter((r) => r.terminalState === 'ENCERRADA')).toHaveLength(1);
  });
});
