// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Ana Paula (16 99444-1006, 17/10/2026) — o pior desfecho possível.
//
// Com o crédito da Anthropic zerado, TODO turno devolvia a mesma fala de
// instabilidade. O guarda anti-repetição via eco e gastava as devoluções uma a
// uma: "Estou aqui, sim" → "Me diz o que você precisa" → "Pode falar comigo" →
// "Sigo à disposição". Esgotadas as quatro, a função devolvia '' — e a
// cliente, que acabara de escrever "estou necessitando muito de dinheiro por
// motivos de saúde e gostaria de saber se vou conseguir minha margem de novo",
// não recebeu NADA. 63 contratos, 2 indícios, dossiê na mão, e silêncio.
//
// O crédito é problema de conta, não de código. O que o código deve garantir é
// que a degradação termine chamando uma pessoa — nunca no vazio.
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

const NOW = new Date('2026-10-17T13:59:05.000Z');
const CHAT = '5516994441006@s.whatsapp.net';

/** A fala que o adaptador devolve quando o LLM está fora (crédito zerado). */
const INSTABILIDADE =
  'Opa, tive uma instabilidade rapidinha aqui 😅 Pode me mandar sua última mensagem de novo, por favor? Já sigo com você.';

/** Tudo o que a AHRI já tinha dito a ela quando a última mensagem chegou. */
const JA_DITAS = [
  INSTABILIDADE,
  'Para eu encaminhar o seu caso à equipe jurídica, preciso só do seu SIM por aqui. Se ficou alguma dúvida antes disso, pode me perguntar.',
  'Estou aqui, sim. Como você quer seguir?',
  'Me diz o que você precisa que eu resolvo por aqui.',
  'Pode falar comigo. O que você gostaria de fazer agora?',
  'Sigo à disposição. Quer que eu continue com o seu caso?',
];

class TestClock implements Clock {
  now(): Date {
    return new Date(NOW.getTime());
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

it('LLM fora + todas as devoluções gastas ⇒ chama uma pessoa, nunca silêncio', async () => {
  const sessions = {
    getOrOpen: () =>
      Promise.resolve({ chatId: CHAT, turns: 18, lastInboundAt: null, lastOutboundAt: null }),
    touchInbound: () => Promise.resolve(),
  } as unknown as SessionRuntime;
  const notas: string[] = [];
  const memory = {
    alreadySeen: () => Promise.resolve(false),
    recordInbound: () => Promise.resolve(),
    recordPercept: () => Promise.resolve(),
    recordIntent: () => Promise.resolve(),
    recordNote: (_c: string, texto: string) => {
      notas.push(texto);
      return Promise.resolve();
    },
    recent: () => Promise.resolve([]),
    recentOutboundTexts: () => Promise.resolve(JA_DITAS),
  } as unknown as ConversationMemoryRuntime;

  const context = new ConversationContextRuntime(
    sessions,
    memory,
    {},
    undefined, // casoFatos
    undefined, // missao
    undefined, // pendencia
    undefined, // onboarding
    undefined, // cpf
    () => Promise.resolve(true), // dossie: JÁ está com a cliente
  );

  const intent: ConversationIntent = {
    id: 'i1',
    chatId: CHAT,
    directive: 'speak',
    speechAct: 'inform',
    topic: 'acompanhamento do caso',
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
    // O LLM está fora: devolve SEMPRE a mesma fala de instabilidade.
    expression: { phrase: () => Promise.resolve(INSTABILIDADE) },
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
    messageId: 'M-saude',
    chatId: CHAT,
    from: CHAT,
    kind: 'text',
    text: 'Estou necessitando muito de dinheiro por motivos de saúde e gostaria de saber se vou conseguir minha margem de novo',
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

  // O que NÃO pode acontecer: nenhuma resposta.
  expect(enfileiradas).toHaveLength(1);
  expect(enfileiradas[0]).toMatch(/algu[ée]m da nossa equipe/i);
  // E nunca a fala de instabilidade crua, nem mais uma devolução já dita.
  expect(enfileiradas[0]).not.toContain('instabilidade');
  expect(JA_DITAS).not.toContain(enfileiradas[0]);
  // O operador precisa saber que essa conversa pede gente.
  expect(notas.some((n) => n.includes('guard anti-repetição'))).toBe(true);
});
