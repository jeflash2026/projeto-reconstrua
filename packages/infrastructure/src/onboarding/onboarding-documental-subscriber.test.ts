// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING DOCUMENTAL SUBSCRIBER (decreto) — e2e da Jornada 1 pelos eventos
// reais: mission.created semeia; document.recognized classifica; a missão da
// conversa muda AUTOMATICAMENTE (onboarding → análise administrativa) quando o
// terceiro obrigatório chega. Retry legítimo quando a transcrição/vínculo ainda
// não está pronto.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type { StoredEvent } from '@reconstrua/application';
import { ObservabilityRuntime, OnboardingDocumentalRuntime } from '@reconstrua/application';
import { InMemoryJsonStore } from '../production/json-store.js';
import { JsonOnboardingDocumentalStore } from './json-onboarding-store.js';
import { OnboardingDocumentalSubscriber } from './onboarding-documental-subscriber.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';
const MISSAO = 'M-1';
class TestClock implements Clock {
  now(): Date { return NOW; }
}

function evento(streamType: string, streamId: string, eventType: string, payload: Record<string, unknown>): StoredEvent {
  return {
    id: `e-${streamId}`, streamType, streamId, version: 1, eventType, isRelevant: true, payload,
    provenance: { factRef: null, actor: 'AHRI', decisionType: null, fundamento: null, operationalRuleRef: null },
    previousHash: null, hash: 'h', occurredAt: NOW, recordedAt: NOW, globalSeq: 1,
  };
}
const missaoCriada = evento('mission', MISSAO, 'mission.created', {});
const docReconhecido = (id: string, fileName: string): StoredEvent =>
  evento('document', id, 'document.recognized', { missionId: MISSAO, contentReference: fileName, mimeType: 'application/pdf' });

function harness(textos: Record<string, string | null>, chatResolvivel = true) {
  const pendencias: string[][] = [];
  const runtime = new OnboardingDocumentalRuntime({
    store: new JsonOnboardingDocumentalStore(new InMemoryJsonStore()),
    leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
    pendencias: { setPendingDocuments: (_c, l) => { pendencias.push([...l]); return Promise.resolve(); } },
  });
  const subscriber = new OnboardingDocumentalSubscriber({
    runtime,
    chatDaMissao: () => (chatResolvivel ? CHAT : null),
    observability: new ObservabilityRuntime(),
    clock: new TestClock(),
  });
  return { runtime, subscriber, pendencias };
}

describe('Decreto · a jornada alimentada pelos eventos reais', () => {
  it('mission.created semeia (3 pendentes) e cada documento leva até 100%', async () => {
    const h = harness({ d1: 'histórico de empréstimo consignado INSS', d2: 'carteira nacional de habilitação', d3: 'fatura de energia elétrica' });
    await h.subscriber.handle(missaoCriada);
    expect(h.pendencias.at(-1)).toEqual(['CNIS', 'IDENTIDADE', 'COMPROVANTE_RESIDENCIA']);
    expect(await h.runtime.estaCompleto(CHAT)).toBe(false); // ⇒ ONBOARDING_DOCUMENTAL

    await h.subscriber.handle(docReconhecido('d1', 'doc.pdf'));
    expect((await h.runtime.visao(CHAT))?.proximo).toContain('RG ou CNH');
    await h.subscriber.handle(docReconhecido('d2', 'IMG_1.jpg'));
    await h.subscriber.handle(docReconhecido('d3', 'IMG_2.jpg'));

    expect(await h.runtime.estaCompleto(CHAT)).toBe(true); // ⇒ ANALISE_ADMINISTRATIVA
    expect(h.pendencias.at(-1)).toEqual([]); // ALIR/Readiness: nada pendente
  });

  it('transcrição AUSENTE + nome inútil ⇒ LANÇA (retry 2A.2); com texto, resolve', async () => {
    const textos: Record<string, string | null> = { dX: null };
    const h = harness(textos);
    await h.subscriber.handle(missaoCriada);
    await expect(h.subscriber.handle(docReconhecido('dX', 'IMG_5555.jpg'))).rejects.toThrow('classificação pendente');
    // A transcrição ficou pronta ⇒ a reentrega classifica.
    textos['dX'] = 'REGISTRO GERAL — órgão emissor SSP';
    await h.subscriber.handle(docReconhecido('dX', 'IMG_5555.jpg'));
    expect((await h.runtime.visao(CHAT))?.recebidos.some((r) => r.includes('RG ou CNH'))).toBe(true);
  });

  it('chat da missão irresolúvel ⇒ LANÇA (a projeção pode estar um ciclo atrás)', async () => {
    const h = harness({}, false);
    await expect(h.subscriber.handle(missaoCriada)).rejects.toThrow('ainda não resolvível');
  });

  it('eventos alheios são ignorados sem efeito', async () => {
    const h = harness({});
    await h.subscriber.handle(evento('person', 'p1', 'person.recognized', {}));
    await h.subscriber.handle(evento('mission', MISSAO, 'mission.closed', {}));
    expect(await h.runtime.visao(CHAT)).toBeNull();
  });
});
