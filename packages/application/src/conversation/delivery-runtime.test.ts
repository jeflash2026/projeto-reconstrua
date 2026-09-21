// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY RUNTIME — ENTREGA IMEDIATA por canal (2026-08-26, "webchat lento"):
// no canal web não há indicador de "digitando", então a encenação humana
// (ler/pensar/digitar + pausa entre mensagens) era atraso puro. Prova:
//   • com entregaImediata ⇒ ZERO espera, zero "digitando", mensagem sai já;
//   • sem o predicado ⇒ a cadência humana continua exatamente como sempre.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import { DeliveryRuntime, type DeliveryRuntimeDeps } from './delivery-runtime.js';
import { HumanLikeTimingRuntime } from './human-like-timing-runtime.js';
import { DEFAULT_HUMANIZATION_POLICY } from './humanization-policy.js';
import type { ConversationContextView, QueuedMessage } from './ports.js';

const AGORA = new Date('2026-08-26T12:00:00.000Z');
const clock: Clock = { now: () => AGORA };

function mensagem(chatId: string): QueuedMessage {
  return {
    id: 'q1',
    chatId,
    seq: 1,
    intentId: 'i1',
    text: 'Olá! Recebi o seu extrato e já estou analisando.',
    enqueuedAt: AGORA,
    status: 'pending',
  };
}

function contexto(chatId: string, chegadaMsAtras = 0): ConversationContextView {
  return {
    chatId,
    lastPercept:
      chegadaMsAtras === 0
        ? null
        : {
            envelope: { text: 'oi, bom dia' },
            perceivedAt: new Date(AGORA.getTime() - chegadaMsAtras),
          },
    recentOutboundTexts: [],
  } as unknown as ConversationContextView;
}

function bancada(chatId: string, entregaImediata?: (c: string) => boolean) {
  const esperas: number[] = [];
  const digitacoes: number[] = [];
  const enviadas: string[] = [];
  let pendente: QueuedMessage | null = mensagem(chatId);
  const deps = {
    gateway: {
      sendText: (_c: string, texto: string) => {
        enviadas.push(texto);
        return Promise.resolve({ providerMessageId: 'p1' });
      },
    },
    timing: new HumanLikeTimingRuntime(DEFAULT_HUMANIZATION_POLICY, () => 0.5),
    typing: {
      typeFor: (_c: string, ms: number) => {
        digitacoes.push(ms);
        return Promise.resolve();
      },
    },
    delay: {
      wait: (ms: number) => {
        if (ms > 0) esperas.push(ms);
        return Promise.resolve();
      },
    },
    presence: { paused: () => Promise.resolve() },
    queue: {
      nextPending: () => {
        const m = pendente;
        pendente = null;
        return Promise.resolve(m);
      },
      markSent: () => Promise.resolve(),
    },
    sessions: { touchOutbound: () => Promise.resolve() },
    memory: {
      recentOutboundTexts: () => Promise.resolve([] as readonly string[]),
      recordOutbound: () => Promise.resolve(),
    },
    clock,
    policy: DEFAULT_HUMANIZATION_POLICY,
    ...(entregaImediata !== undefined ? { entregaImediata } : {}),
  } as unknown as DeliveryRuntimeDeps;
  return { runtime: new DeliveryRuntime(deps), esperas, digitacoes, enviadas };
}

describe('DeliveryRuntime — entrega imediata por canal', () => {
  it('canal web (predicado true) ⇒ envia SEM esperar e SEM encenar digitação', async () => {
    const chatId = '5548999990000@webchat';
    const b = bancada(chatId, (c) => c.endsWith('@webchat'));
    const entregues = await b.runtime.drain(contexto(chatId));
    expect(entregues).toHaveLength(1);
    expect(b.enviadas).toHaveLength(1);
    expect(b.esperas).toHaveLength(0); // zero delay artificial
    expect(b.digitacoes).toHaveLength(0); // zero "digitando"
    expect(entregues[0]?.timing.totalMs).toBe(0);
  });

  it('WhatsApp (predicado false) ⇒ a cadência humana continua intacta', async () => {
    const chatId = '5548999990000@s.whatsapp.net';
    const b = bancada(chatId, (c) => c.endsWith('@webchat'));
    await b.runtime.drain(contexto(chatId));
    expect(b.enviadas).toHaveLength(1);
    expect(b.esperas.length).toBeGreaterThan(0); // leu/pensou antes de enviar
    expect(b.digitacoes.length).toBeGreaterThan(0); // e "digitou" visivelmente
  });

  // AGILIDADE (2026-09-21): o tempo que o turno gastou no LLM já é espera REAL
  // do cliente; a encenação desconta esse tempo em vez de somar por cima.
  it('turno demorado ⇒ desconta o tempo já decorrido e envia quase na hora', async () => {
    const chatId = '5548999990000@s.whatsapp.net';
    const b = bancada(chatId, (c) => c.endsWith('@webchat'));
    await b.runtime.drain(contexto(chatId, 30_000)); // a mensagem chegou há 30 s
    expect(b.enviadas).toHaveLength(1);
    expect(b.esperas).toHaveLength(0); // nada de ler/pensar: isso já passou
    // Ainda "digita" antes de enviar — nunca instantâneo, nunca robótico.
    expect(b.digitacoes[0]).toBe(DEFAULT_HUMANIZATION_POLICY.minTypeMs);
  });

  it('turno rápido ⇒ a cadência humana continua inteira', async () => {
    const chatId = '5548999990000@s.whatsapp.net';
    const b = bancada(chatId, (c) => c.endsWith('@webchat'));
    await b.runtime.drain(contexto(chatId, 1)); // chegou agora
    const total = (b.esperas[0] ?? 0) + (b.digitacoes[0] ?? 0);
    expect(total).toBeGreaterThanOrEqual(DEFAULT_HUMANIZATION_POLICY.minPreSendMs);
  });

  it('sem o predicado (montagens antigas) ⇒ comportamento de sempre', async () => {
    const chatId = '5548999990000@webchat';
    const b = bancada(chatId); // predicado ausente
    await b.runtime.drain(contexto(chatId));
    expect(b.esperas.length).toBeGreaterThan(0);
  });
});
