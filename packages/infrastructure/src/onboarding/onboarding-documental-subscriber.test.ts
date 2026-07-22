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
import {
  OnboardingDocumentalSubscriber,
  criarResolverDeChat,
} from './onboarding-documental-subscriber.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';
const MISSAO = 'M-1';
class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}

function evento(
  streamType: string,
  streamId: string,
  eventType: string,
  payload: Record<string, unknown>,
): StoredEvent {
  return {
    id: `e-${streamId}`,
    streamType,
    streamId,
    version: 1,
    eventType,
    isRelevant: true,
    payload,
    provenance: {
      factRef: null,
      actor: 'AHRI',
      decisionType: null,
      fundamento: null,
      operationalRuleRef: null,
    },
    previousHash: null,
    hash: 'h',
    occurredAt: NOW,
    recordedAt: NOW,
    globalSeq: 1,
  };
}
const missaoCriada = evento('mission', MISSAO, 'mission.created', {});
const docReconhecido = (id: string, fileName: string): StoredEvent =>
  evento('document', id, 'document.recognized', {
    missionId: MISSAO,
    contentReference: fileName,
    mimeType: 'application/pdf',
  });

function harness(textos: Record<string, string | null>, chatResolvivel = true) {
  const pendencias: string[][] = [];
  const progressos: string[] = [];
  const runtime = new OnboardingDocumentalRuntime({
    store: new JsonOnboardingDocumentalStore(new InMemoryJsonStore()),
    leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
    pendencias: {
      setPendingDocuments: (_c, l) => {
        pendencias.push([...l]);
        return Promise.resolve();
      },
    },
  });
  const subscriber = new OnboardingDocumentalSubscriber({
    runtime,
    chatDaMissao: () => Promise.resolve(chatResolvivel ? CHAT : null),
    observability: new ObservabilityRuntime(),
    clock: new TestClock(),
    comunicador: {
      enviar: (_c, texto) => {
        progressos.push(texto);
        return Promise.resolve();
      },
    },
  });
  return { runtime, subscriber, pendencias, progressos };
}

describe('Decreto · a jornada alimentada pelos eventos reais', () => {
  it('mission.created semeia (HISCON pendente) e cada documento leva até 100%', async () => {
    const h = harness({
      d1: 'histórico de empréstimo consignado INSS',
      d2: 'carteira nacional de habilitação',
      d3: 'fatura de energia elétrica',
    });
    await h.subscriber.handle(missaoCriada);
    expect(h.pendencias.at(-1)).toEqual(['CNIS']);
    expect(await h.runtime.estaCompleto(CHAT)).toBe(false); // ⇒ ONBOARDING_DOCUMENTAL

    // Decreto HISCON-only: o próprio HISCON COMPLETA a jornada inicial.
    await h.subscriber.handle(docReconhecido('d1', 'doc.pdf'));
    // 5ª rodada — PROGRESSÃO AUTOMÁTICA: a AHRI avisa sozinha (aqui, a conclusão).
    expect(h.progressos[0]).toContain('Registrado: HISCON');
    expect(h.progressos[0]).toContain('documentação inicial está completa');

    expect(await h.runtime.estaCompleto(CHAT)).toBe(true); // ⇒ ANALISE_ADMINISTRATIVA
    expect(h.pendencias.at(-1)).toEqual([]); // ALIR/Readiness: nada pendente
  });

  it('transcrição AUSENTE + nome inútil ⇒ LANÇA (retry 2A.2); com texto, resolve', async () => {
    const textos: Record<string, string | null> = { dX: null };
    const h = harness(textos);
    await h.subscriber.handle(missaoCriada);
    await expect(h.subscriber.handle(docReconhecido('dX', 'IMG_5555.jpg'))).rejects.toThrow(
      'classificação pendente',
    );
    // A transcrição ficou pronta ⇒ a reentrega classifica.
    textos['dX'] = 'REGISTRO GERAL — órgão emissor SSP';
    await h.subscriber.handle(docReconhecido('dX', 'IMG_5555.jpg'));
    expect((await h.runtime.visao(CHAT))?.recebidos.some((r) => r.includes('RG'))).toBe(true);
  });

  it('SOLUÇÃO DEFINITIVA: com sleeper, ESPERA a transcrição DENTRO do turno e classifica sem lançar', async () => {
    // O cenário real das 4 rodadas: a imagem chega, o vínculo/transcrição leva
    // alguns segundos — a AHRI deve ENXERGAR o documento antes de responder.
    const textos: Record<string, string | null> = { dY: null };
    const pendencias: string[][] = [];
    const runtime = new OnboardingDocumentalRuntime({
      store: new JsonOnboardingDocumentalStore(new InMemoryJsonStore()),
      leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
      pendencias: {
        setPendingDocuments: (_c, l) => {
          pendencias.push([...l]);
          return Promise.resolve();
        },
      },
    });
    let esperas = 0;
    const subscriber = new OnboardingDocumentalSubscriber({
      runtime,
      chatDaMissao: () => Promise.resolve(CHAT),
      observability: new ObservabilityRuntime(),
      clock: new TestClock(),
      sleeper: {
        sleep: () => {
          esperas += 1;
          // A transcrição "fica pronta" durante a 2ª espera (captura assíncrona real).
          if (esperas === 2) textos['dY'] = 'CARTEIRA DE IDENTIDADE — REGISTRO GERAL';
          return Promise.resolve();
        },
      },
    });
    await subscriber.handle(missaoCriada);
    await subscriber.handle(docReconhecido('dY', 'IMG_7777.jpg')); // NÃO lança
    expect(esperas).toBeGreaterThanOrEqual(2);
    expect((await runtime.visao(CHAT))?.recebidos.some((r) => r.includes('RG'))).toBe(true);
    expect((await runtime.visao(CHAT))?.proximo).toContain('HISCON'); // pendente segue o decreto HISCON-only
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

describe('7ª rodada · progressão TARDIA só com o marcador (sem duplicar a fala do turno)', () => {
  it('marcador INATIVO (registro aterrissou no turno; a resposta da jornada fala o fato) ⇒ subscriber NÃO envia', async () => {
    const progressos: string[] = [];
    const runtime = new OnboardingDocumentalRuntime({
      store: new JsonOnboardingDocumentalStore(new InMemoryJsonStore()),
      leitor: { texto: () => Promise.resolve('carteira nacional de habilitação') },
      pendencias: null,
    });
    const subscriber = new OnboardingDocumentalSubscriber({
      runtime,
      chatDaMissao: () => Promise.resolve(CHAT),
      observability: new ObservabilityRuntime(),
      clock: new TestClock(),
      comunicador: {
        enviar: (_c, t) => {
          progressos.push(t);
          return Promise.resolve();
        },
      },
      jornada: {
        estaAguardandoProgressao: () => Promise.resolve(false),
        concluirProgressao: () => Promise.resolve(),
      },
    });
    await subscriber.handle(missaoCriada);
    await subscriber.handle(docReconhecido('dZ', 'IMG_1.jpg'));
    expect(progressos).toHaveLength(0); // a resposta do turno já falou o fato
  });

  it('marcador ATIVO (o turno respondeu só o ack) ⇒ subscriber envia e conclui o marcador', async () => {
    const progressos: string[] = [];
    let concluiu = 0;
    const runtime = new OnboardingDocumentalRuntime({
      store: new JsonOnboardingDocumentalStore(new InMemoryJsonStore()),
      leitor: { texto: () => Promise.resolve('carteira nacional de habilitação') },
      pendencias: null,
    });
    const subscriber = new OnboardingDocumentalSubscriber({
      runtime,
      chatDaMissao: () => Promise.resolve(CHAT),
      observability: new ObservabilityRuntime(),
      clock: new TestClock(),
      comunicador: {
        enviar: (_c, t) => {
          progressos.push(t);
          return Promise.resolve();
        },
      },
      jornada: {
        estaAguardandoProgressao: () => Promise.resolve(true),
        concluirProgressao: () => {
          concluiu += 1;
          return Promise.resolve();
        },
      },
    });
    await subscriber.handle(missaoCriada);
    await subscriber.handle(docReconhecido('dZ', 'IMG_1.jpg'));
    expect(progressos[0]).toContain('✅ Registrado: CNH');
    expect(concluiu).toBe(1);
  });
});

describe('Regressão GO-LIVE · resolver AUTO-ATUALIZÁVEL (projector vazio pós-restart)', () => {
  it('projector VAZIO (recém-restartado) ⇒ refresh incremental resolve o chat', async () => {
    // O cenário exato da produção: container recriado, projeção em memória zerada.
    let projetado: { missionId: string; chatId: string }[] = [];
    let refreshes = 0;
    const resolver = criarResolverDeChat({
      missions: () => projetado,
      refresh: () => {
        refreshes += 1;
        projetado = [{ missionId: MISSAO, chatId: CHAT }];
        return Promise.resolve();
      },
    });
    expect(await resolver(MISSAO)).toBe(CHAT); // resolveu SEM depender do painel admin
    expect(refreshes).toBe(1);
  });

  it('já projetado ⇒ nenhum refresh extra (caminho quente barato)', async () => {
    let refreshes = 0;
    const resolver = criarResolverDeChat({
      missions: () => [{ missionId: MISSAO, chatId: CHAT }],
      refresh: () => {
        refreshes += 1;
        return Promise.resolve();
      },
    });
    expect(await resolver(MISSAO)).toBe(CHAT);
    expect(refreshes).toBe(0);
  });

  it('missão realmente inexistente ⇒ null mesmo após refresh (retry do dispatcher decide)', async () => {
    const resolver = criarResolverDeChat({ missions: () => [], refresh: () => Promise.resolve() });
    expect(await resolver('M-inexistente')).toBeNull();
  });

  it('refresh falhando (banco fora) ⇒ null sem exceção', async () => {
    const resolver = criarResolverDeChat({
      missions: () => [],
      refresh: () => Promise.reject(new Error('pg down')),
    });
    await expect(resolver(MISSAO)).resolves.toBeNull();
  });
});
