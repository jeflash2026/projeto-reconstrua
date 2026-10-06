// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Ana Lúcia (16 99237-5046, 06/10/2026) — ela mandou o documento como
// LINK do Adobe DUAS vezes. Na primeira recebeu a orientação certa (baixar e
// anexar o PDF). Na segunda, a MESMA orientação — que era a resposta correta,
// porque ela repetiu o mesmo engano — foi barrada pelo guard anti-repetição e
// virou "Estou aqui, sim. Como você quer seguir?". A cliente, que já não sabia
// o que fazer, respondeu "Não sei" e a conversa morreu ali.
//
// O guard existe para a expressão que entra em loop sozinha. Pedido de coleta
// NOMEADO (CPF, HISCON, comprovante, procuração) repete quando a situação
// repete — isso é atendimento, não eco.
// ─────────────────────────────────────────────────────────────────────────────
import { it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import { ConversationRuntime } from './conversation-runtime.js';
import { ConversationContextRuntime } from './conversation-context-runtime.js';
import { PromptBuilderRuntime } from './prompt-builder-runtime.js';
import { DEFAULT_HUMANIZATION_POLICY } from './humanization-policy.js';
import type { ConversationIntent } from './intent.js';
import type { SessionRuntime } from './session-runtime.js';
import type { ConversationMemoryRuntime } from './conversation-memory-runtime.js';

const NOW = new Date('2026-10-06T12:31:00.000Z');
const CHAT = '5516992375046@s.whatsapp.net';

// O roteiro autorado da jornada para link — o mesmo das duas vezes.
const ORIENTACAO_DO_LINK =
  'Recebi o seu link, obrigada. Só que por segurança eu não consigo abrir documentos por link — preciso do ARQUIVO aqui na conversa mesmo.\n\n' +
  'É simples: abra o documento no aplicativo, toque em "Baixar" (ou "Salvar no celular") e depois me envie o arquivo em PDF como anexo aqui no WhatsApp.\n\n' +
  'Estou aguardando: HISCON (histórico de empréstimos consignados do INSS).';

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

it('link repetido ⇒ a orientação sai de novo, não vira devolução genérica', async () => {
  const sessions = {
    getOrOpen: () =>
      Promise.resolve({ chatId: CHAT, turns: 14, lastInboundAt: null, lastOutboundAt: null }),
    touchInbound: () => Promise.resolve(),
  } as unknown as SessionRuntime;
  const memory = {
    alreadySeen: () => Promise.resolve(false),
    recordInbound: () => Promise.resolve(),
    recordPercept: () => Promise.resolve(),
    recordIntent: () => Promise.resolve(),
    recordNote: () => Promise.resolve(),
    recent: () => Promise.resolve([]),
    // A orientação JÁ foi dita no link anterior — é o que antes a derrubava.
    recentOutboundTexts: () => Promise.resolve([ORIENTACAO_DO_LINK]),
  } as unknown as ConversationMemoryRuntime;

  const context = new ConversationContextRuntime(sessions, memory, {});

  const intent: ConversationIntent = {
    id: 'i1',
    chatId: CHAT,
    directive: 'speak',
    speechAct: 'request_document',
    topic: 'coleta',
    references: [],
    urgency: 'normal',
    operationalRuleRef: 'RO-X',
    fundamento: 'f',
    timingHintMs: null,
    formedAt: NOW,
  };

  const enfileiradas: string[] = [];
  const runtime = new ConversationRuntime({
    perception: {
      understand: () =>
        Promise.resolve({ perceivedPurpose: 'service_request', sentiment: 'neutral' } as never),
    },
    // A jornada é determinística: mesmo engano, mesmo roteiro.
    expression: { phrase: () => Promise.resolve(ORIENTACAO_DO_LINK) },
    brain: { decide: () => Promise.resolve([intent]) },
    gateway: { markRead: () => Promise.resolve() } as never,
    sessions,
    memory,
    context,
    promptBuilder: new PromptBuilderRuntime(8),
    queue: {
      enqueue: (_c: string, _i: string, texto: string) => {
        enfileiradas.push(texto);
        return Promise.resolve();
      },
    } as never,
    delivery: { drain: () => Promise.resolve([]) } as never,
    silence: {} as never,
    clock: new TestClock(),
    uuid: new SeqUuid(),
    policy: DEFAULT_HUMANIZATION_POLICY,
  });

  await runtime.receive({
    messageId: 'M-link-2',
    chatId: CHAT,
    from: CHAT,
    kind: 'text',
    text: 'https://acrobat.adobe.com/id/urn:aaid:sc:VA6C2:5aca547d',
    mediaUrl: null,
    mediaMimeType: null,
    fileName: null,
    location: null,
    contact: null,
    reactionEmoji: null,
    reactionToMessageId: null,
    editedText: null,
    deletedMessageId: null,
    silenceMs: null,
    timestamp: NOW,
  });

  expect(enfileiradas).toHaveLength(1);
  expect(enfileiradas[0]).toContain('não consigo abrir documentos por link');
  expect(enfileiradas[0]).toContain('HISCON');
  // Nunca a frase que matou o atendimento real.
  expect(enfileiradas[0]).not.toMatch(/Como você quer seguir|resolvo por aqui/iu);
});
