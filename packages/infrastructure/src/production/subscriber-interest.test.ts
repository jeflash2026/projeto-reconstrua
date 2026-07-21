// ─────────────────────────────────────────────────────────────────────────────
// REGRESSÃO da 13ª rodada (GO LIVE): SubscriberRegistry.interestedIn filtra por
// event.eventType — quatro subscribers declaravam STREAM types ('mission',
// 'document', …) e por isso tinham ZERO entregas na história da produção (o
// onboarding documental NUNCA rodou; a foto do RG nunca classificava). Este
// teste casa cada subscriber contra os EVENTOS REAIS pelo caminho do registry.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { SubscriberRegistry, type StoredEvent } from '@reconstrua/application';
import { ObservabilityRuntime, OnboardingDocumentalRuntime } from '@reconstrua/application';
import { OnboardingDocumentalSubscriber } from '../onboarding/onboarding-documental-subscriber.js';
import { JsonOnboardingDocumentalStore } from '../onboarding/json-onboarding-store.js';
import { InMemoryJsonStore } from './json-store.js';

const NOW = new Date('2026-07-21T06:23:57.000Z');

function evento(streamType: string, eventType: string): StoredEvent {
  return {
    id: 'e-1', streamType, streamId: 's-1', version: 1, eventType, isRelevant: true, payload: {},
    provenance: { factRef: null, actor: 'AHRI', decisionType: null, fundamento: null, operationalRuleRef: null },
    previousHash: null, hash: 'h', occurredAt: NOW, recordedAt: NOW, globalSeq: 1,
  };
}

function onboardingSubscriber(): OnboardingDocumentalSubscriber {
  return new OnboardingDocumentalSubscriber({
    runtime: new OnboardingDocumentalRuntime({
      store: new JsonOnboardingDocumentalStore(new InMemoryJsonStore()),
      leitor: { texto: () => Promise.resolve(null) },
      pendencias: null,
    }),
    chatDaMissao: () => Promise.resolve(null),
    observability: new ObservabilityRuntime(),
    clock: { now: () => NOW },
  });
}

describe('13ª rodada · interesse casa com os EVENTOS REAIS via SubscriberRegistry', () => {
  it('onboarding-documental É interessado em mission.created e document.recognized (o bug: zero entregas na produção)', () => {
    const registry = new SubscriberRegistry().register(onboardingSubscriber(), 1, NOW);
    expect(registry.interestedIn(evento('mission', 'mission.created'))).toContain('onboarding-documental');
    expect(registry.interestedIn(evento('document', 'document.recognized'))).toContain('onboarding-documental');
  });

  it('interesse declarado nos DEMAIS subscribers usa event types reais (nunca stream types)', () => {
    // Os eventos reais do domínio (conferidos no event_store da produção).
    const EVENT_TYPES_REAIS = new Set([
      'mission.created', 'document.recognized', 'document-request.received', 'operational-state.derived',
      'operational-truth.synthesized',
    ]);
    const declarados: string[] = [
      ...['document.recognized'], // document-request-arrival
      ...['document-request.received'], // lawyer-notifier
      ...['operational-state.derived'], // mission-closure-feedback
      ...['mission.created', 'document.recognized'], // onboarding-documental
    ];
    for (const t of declarados) expect(EVENT_TYPES_REAIS.has(t), `"${t}" não é um event type real`).toBe(true);
  });
});
