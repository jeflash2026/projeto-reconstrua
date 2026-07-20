// ─────────────────────────────────────────────────────────────────────────────
// REGRESSÃO GO-LIVE — a CORRIDA do primeiro cliente real: o cliente envia o
// HISCON e a AHRI respondia pedindo o MESMO HISCON, porque a fala usava o
// contexto construído ANTES do pipeline (que reconhece o documento, classifica
// a Jornada 1 e atualiza as pendências DENTRO do turno).
//
// Correção provada aqui: o Brain decide com a visão da CHEGADA; a EXPRESSÃO
// fala com a visão PÓS-DECISÃO (context.build reconstruído no 3b).
// ─────────────────────────────────────────────────────────────────────────────
import { it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import { ConversationRuntime } from './conversation-runtime.js';
import { ConversationContextRuntime } from './conversation-context-runtime.js';
import { PromptBuilderRuntime } from './prompt-builder-runtime.js';
import { DEFAULT_HUMANIZATION_POLICY } from './humanization-policy.js';
import type { ConversationIntent } from './intent.js';
import type { InboundEnvelope } from './percept.js';
import type { ConversationContextView } from './ports.js';
import type { SessionRuntime } from './session-runtime.js';
import type { ConversationMemoryRuntime } from './conversation-memory-runtime.js';

const NOW = new Date('2026-07-20T12:28:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';
class TestClock implements Clock {
  now(): Date { return NOW; }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid { this.n += 1; return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`); }
}

const ROTULO_HISCON = 'HISCON (histórico de empréstimos consignados do INSS)';
const ROTULO_RG = 'RG ou CNH (documento de identidade com foto)';
const ROTULO_END = 'comprovante de endereço';

function envelope(over: Partial<InboundEnvelope>): InboundEnvelope {
  return {
    messageId: 'M1', chatId: CHAT, from: CHAT, kind: 'document', text: null,
    mediaUrl: 'https://wa/media/1', mediaMimeType: 'application/pdf',
    fileName: 'extrato_emprestimo_consignado_completo_030726.pdf',
    location: null, contact: null, reactionEmoji: null, reactionToMessageId: null,
    editedText: null, deletedMessageId: null, silenceMs: null, timestamp: NOW,
    ...over,
  };
}

it('a fala usa o contexto PÓS-decisão: HISCON recebido no turno ⇒ confirma e pede o PRÓXIMO', async () => {
  // A contabilidade da Jornada 1 — mutada pelo "pipeline" DURANTE o decide.
  let jornada = {
    recebidos: [] as string[],
    faltando: [ROTULO_HISCON, ROTULO_RG, ROTULO_END],
    proximo: ROTULO_HISCON as string | null,
  };

  const sessions = {
    getOrOpen: () => Promise.resolve({ chatId: CHAT, turns: 3, lastInboundAt: null, lastOutboundAt: null }),
    touchInbound: () => Promise.resolve(),
  } as unknown as SessionRuntime;
  const memory = {
    alreadySeen: () => Promise.resolve(false),
    recordInbound: () => Promise.resolve(),
    recordPercept: () => Promise.resolve(),
    recordIntent: () => Promise.resolve(),
    recordNote: () => Promise.resolve(),
    recent: () => Promise.resolve([]),
    recentOutboundTexts: () => Promise.resolve([]),
  } as unknown as ConversationMemoryRuntime;

  const context = new ConversationContextRuntime(
    sessions, memory, {}, undefined,
    () => Promise.resolve('ONBOARDING_DOCUMENTAL'),
    undefined,
    () => Promise.resolve({ ...jornada }),
  );

  const intent: ConversationIntent = {
    id: 'i1', chatId: CHAT, directive: 'speak', speechAct: 'inform', topic: 'documentos',
    references: [], urgency: 'normal', operationalRuleRef: 'RO-X', fundamento: 'f',
    timingHintMs: null, formedAt: NOW,
  };
  // O "pipeline" real: reconhece o documento e ATUALIZA a contabilidade no turno.
  const brain = {
    decide: () => {
      jornada = { recebidos: [ROTULO_HISCON], faltando: [ROTULO_RG, ROTULO_END], proximo: ROTULO_RG };
      return Promise.resolve([intent]);
    },
  };

  const styleGuidances: string[] = [];
  const viewsDaEntrega: ConversationContextView[] = [];
  const runtime = new ConversationRuntime({
    perception: { understand: () => Promise.resolve({ perceivedPurpose: 'service_request', sentiment: 'neutral' } as never) },
    expression: { phrase: (req: { styleGuidance: string }) => { styleGuidances.push(req.styleGuidance); return Promise.resolve(`resposta-${String(styleGuidances.length)}`); } },
    brain: brain,
    gateway: { markRead: () => Promise.resolve() } as never,
    sessions,
    memory,
    context,
    promptBuilder: new PromptBuilderRuntime(8),
    queue: { enqueue: () => Promise.resolve() } as never,
    delivery: { drain: (v: ConversationContextView) => { viewsDaEntrega.push(v); return Promise.resolve([]); } } as never,
    silence: {} as never,
    clock: new TestClock(),
    uuid: new SeqUuid(),
    policy: DEFAULT_HUMANIZATION_POLICY,
  });

  const result = await runtime.receive(envelope({}));
  expect(result.skipped).toBe(false);

  // A REGRESSÃO: a fala tem de enxergar o HISCON JÁ RECEBIDO e pedir o PRÓXIMO.
  const sg = styleGuidances[0] ?? '';
  expect(sg).toContain(`Já recebidos e CONFIRMADOS: ${ROTULO_HISCON}`);
  expect(sg).toContain(`Solicite AGORA, nesta resposta, APENAS o próximo: ${ROTULO_RG}`);
  expect(sg).not.toContain(`próximo: ${ROTULO_HISCON}`); // jamais pedir o que acabou de chegar
  // A guarda do arquivo-no-turno também está presente (envelope com fileName).
  expect(sg).toContain('ACABOU de enviar um arquivo NESTA mensagem');
  // A entrega também usa a visão pós-decisão.
  expect(viewsDaEntrega[0]?.onboardingDocumental?.proximo).toBe(ROTULO_RG);
});

it('classificação AINDA pendente (contabilidade não mudou) ⇒ agradece e NÃO re-pede o mesmo documento', async () => {
  const jornada = { recebidos: [] as string[], faltando: [ROTULO_HISCON, ROTULO_RG, ROTULO_END], proximo: ROTULO_HISCON };
  const sessions = {
    getOrOpen: () => Promise.resolve({ chatId: CHAT, turns: 3, lastInboundAt: null, lastOutboundAt: null }),
    touchInbound: () => Promise.resolve(),
  } as unknown as SessionRuntime;
  const memory = {
    alreadySeen: () => Promise.resolve(false), recordInbound: () => Promise.resolve(),
    recordPercept: () => Promise.resolve(), recordIntent: () => Promise.resolve(),
    recordNote: () => Promise.resolve(), recent: () => Promise.resolve([]),
    recentOutboundTexts: () => Promise.resolve([]),
  } as unknown as ConversationMemoryRuntime;
  const context = new ConversationContextRuntime(
    sessions, memory, {}, undefined,
    () => Promise.resolve('ONBOARDING_DOCUMENTAL'), undefined,
    () => Promise.resolve({ ...jornada }),
  );
  const intent: ConversationIntent = {
    id: 'i1', chatId: CHAT, directive: 'speak', speechAct: 'inform', topic: 'documentos',
    references: [], urgency: 'normal', operationalRuleRef: 'RO-X', fundamento: 'f',
    timingHintMs: null, formedAt: NOW,
  };
  const styleGuidances: string[] = [];
  const runtime = new ConversationRuntime({
    perception: { understand: () => Promise.resolve({ perceivedPurpose: 'service_request', sentiment: 'neutral' } as never) },
    expression: { phrase: (req: { styleGuidance: string }) => { styleGuidances.push(req.styleGuidance); return Promise.resolve('ok'); } },
    brain: { decide: () => Promise.resolve([intent]) },
    gateway: { markRead: () => Promise.resolve() } as never,
    sessions, memory, context,
    promptBuilder: new PromptBuilderRuntime(8),
    queue: { enqueue: () => Promise.resolve() } as never,
    delivery: { drain: () => Promise.resolve([]) } as never,
    silence: {} as never,
    clock: new TestClock(),
    uuid: new SeqUuid(),
    policy: DEFAULT_HUMANIZATION_POLICY,
  });

  await runtime.receive(envelope({}));
  const sg = styleGuidances[0] ?? '';
  expect(sg).toContain('ACABOU de enviar um arquivo NESTA mensagem');
  expect(sg).toContain('NÃO peça novamente o documento que ela acabou de mandar');
});
