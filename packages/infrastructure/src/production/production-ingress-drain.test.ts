// ─────────────────────────────────────────────────────────────────────────────
// DEPLOY GRACIOSO (caso REAL Iracema 5551 9232-3343, 2026-07-31) — o drain dos
// turnos em voo: aguardarTurnosEmVoo espera as cadeias terminarem (o restart
// nunca engole a resposta de um cliente) e respeita o teto quando um turno
// trava (o processo não fica preso para sempre).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ConversationRuntime, InboundEnvelope, TurnResult } from '@reconstrua/application';
import { ProductionIngress } from './production-ingress.js';

function envelope(chatId: string, texto: string): InboundEnvelope {
  return {
    messageId: `m-${texto}`,
    chatId,
    from: chatId,
    kind: 'text',
    text: texto,
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
    timestamp: new Date('2026-07-31T16:46:00.000Z'),
  };
}

function ingressCom(receive: (e: InboundEnvelope) => Promise<TurnResult>): ProductionIngress {
  const conversation = { receive } as unknown as ConversationRuntime;
  const scheduler = { fireDue: () => Promise.resolve([]) } as never;
  return new ProductionIngress(conversation, scheduler);
}

describe('ProductionIngress.aguardarTurnosEmVoo (deploy gracioso)', () => {
  it('espera o turno em voo TERMINAR antes de liberar o desligamento', async () => {
    let concluiu = false;
    const ingress = ingressCom(
      (e) =>
        new Promise((resolve) => {
          setTimeout(() => {
            concluiu = true;
            resolve({ chatId: e.chatId } as unknown as TurnResult);
          }, 30);
        }),
    );
    const turno = ingress.receive(envelope('555192323343@s.whatsapp.net', 'Porto Alegre'));
    await ingress.aguardarTurnosEmVoo(5_000);
    expect(concluiu).toBe(true); // o restart não engoliu o turno da Iracema
    await turno;
  });

  it('turno TRAVADO não prende o desligamento além do teto', async () => {
    const ingress = ingressCom(() => new Promise(() => undefined)); // nunca resolve
    void ingress.receive(envelope('555192323343@s.whatsapp.net', 'oi')).catch(() => undefined);
    const inicio = Date.now();
    await ingress.aguardarTurnosEmVoo(50);
    expect(Date.now() - inicio).toBeLessThan(2_000); // saiu pelo teto, não pendurou
  });

  it('sem turnos em voo, o drain é imediato', async () => {
    const ingress = ingressCom(() => Promise.resolve({} as TurnResult));
    await ingress.aguardarTurnosEmVoo(5_000); // resolve sem esperar nada
  });
});
