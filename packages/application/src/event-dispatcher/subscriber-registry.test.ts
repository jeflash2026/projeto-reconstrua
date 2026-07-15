// ─────────────────────────────────────────────────────────────────────────────
// Testes do Subscriber Registry — registro dinâmico, versionamento, descoberta e
// filtro por interesse.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { SubscriberRegistry } from './subscriber-registry.js';
import type { EventSubscriber, StoredEvent } from '../event-store/index.js';

function sub(name: string, interestedIn?: readonly string[]): EventSubscriber {
  return {
    name,
    ...(interestedIn ? { interestedIn } : {}),
    handle(): Promise<void> {
      return Promise.resolve();
    },
  };
}

function evt(eventType: string): StoredEvent {
  return {
    id: 'e1',
    streamType: 'mission',
    streamId: 'm1',
    version: 1,
    eventType,
    isRelevant: false,
    payload: {},
    provenance: { factRef: null, actor: null, decisionType: null, fundamento: null, operationalRuleRef: null },
    previousHash: null,
    hash: 'h',
    occurredAt: new Date(0),
    recordedAt: new Date(0),
    globalSeq: 1,
  };
}

describe('SubscriberRegistry', () => {
  it('registra dinamicamente, versiona e descobre', () => {
    const r = new SubscriberRegistry();
    r.register(sub('cqrs'), 1);
    expect(r.versionOf('cqrs')).toBe(1);
    expect(r.get('cqrs')?.name).toBe('cqrs');
    expect(r.all()).toHaveLength(1);
    // Re-registro atualiza a versão.
    r.register(sub('cqrs'), 2);
    expect(r.versionOf('cqrs')).toBe(2);
    expect(r.all()).toHaveLength(1);
  });

  it('remove (unregister)', () => {
    const r = new SubscriberRegistry();
    r.register(sub('x'));
    expect(r.unregister('x')).toBe(true);
    expect(r.get('x')).toBeUndefined();
    expect(r.unregister('x')).toBe(false);
  });

  it('interestedIn filtra por tipo de evento (ausente = todos)', () => {
    const r = new SubscriberRegistry();
    r.register(sub('all')); // interesse em tudo
    r.register(sub('docs', ['document.recognized']));
    expect([...r.interestedIn(evt('mission.created'))].sort()).toEqual(['all']);
    expect([...r.interestedIn(evt('document.recognized'))].sort()).toEqual(['all', 'docs']);
  });
});
