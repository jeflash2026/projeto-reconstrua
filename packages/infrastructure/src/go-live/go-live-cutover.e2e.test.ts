// ─────────────────────────────────────────────────────────────────────────────
// GO-LIVE 10E — PRODUCTION CUTOVER (e2e). Um atendimento ponta a ponta na
// produção simulada percorre o PIPELINE AUTÔNOMO oficial:
//   Mensagem recebida → processTurn (Truth → Strategic → Executive Mind →
//   Planner → Mission) → Conversa → Resposta enviada.
// Confirma que o FullLoopBrainAdapter (legado) NÃO participou; e que o flag
// 'legacy' faz rollback imediato para o laço antigo.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { InboundEnvelope } from '@reconstrua/application';
import { InMemoryConversationGateway } from '../conversation/in-memory-conversation-gateway.js';
import { FakeSleeper } from '../conversation/system-sleeper.js';
import { assembleGoLive, type PipelineMode } from './build-go-live.js';
import { FullLoopBrainAdapter } from './full-loop-brain-adapter.js';
import { AutonomousBrainAdapter } from '../pipeline/autonomous-brain-adapter.js';

const T0 = new Date('2026-07-19T00:00:00.000Z');
const CHAT = '5511966665555@s.whatsapp.net';

class TestClock implements Clock {
  private t = new Date(T0.getTime());
  now(): Date { return new Date(this.t.getTime()); }
  advance(ms: number): void { this.t = new Date(this.t.getTime() + ms); }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid { this.n += 1; return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`); }
}

function envelope(text: string, messageId: string): InboundEnvelope {
  return {
    messageId, chatId: CHAT, from: CHAT, kind: 'text', text,
    mediaUrl: null, mediaMimeType: null, fileName: null, location: null, contact: null,
    reactionEmoji: null, reactionToMessageId: null, editedText: null, deletedMessageId: null,
    silenceMs: null, timestamp: T0,
  };
}

function harness(pipeline?: PipelineMode) {
  const clock = new TestClock();
  const gateway = new InMemoryConversationGateway(clock);
  const live = assembleGoLive({ clock, uuid: new SeqUuid(), gateway, sleeper: new FakeSleeper(clock), rng: () => 0.5, ...(pipeline ? { pipeline } : {}) });
  return { live, gateway, clock };
}

describe('GO-LIVE 10E · cutover — o pipeline autônomo é o único caminho oficial', () => {
  it('atendimento ponta a ponta: mensagem → pipeline autônomo → resposta; FullLoop NÃO participa', async () => {
    const autoSpy = vi.spyOn(AutonomousBrainAdapter.prototype, 'decide');
    const legacySpy = vi.spyOn(FullLoopBrainAdapter.prototype, 'decide');
    try {
      const { live, gateway } = harness(); // default = autonomous

      expect(live.pipelineMode).toBe('autonomous');
      await live.conversation.receive(envelope('olá, preciso de ajuda com meu consignado', 'M1'));

      // Resposta enviada ao cliente (a Conversa fraseou as intenções do pipeline).
      expect(gateway.texts().length).toBeGreaterThanOrEqual(1);
      // O pipeline autônomo executou; o laço legado NÃO participou.
      expect(autoSpy).toHaveBeenCalled();
      expect(legacySpy).not.toHaveBeenCalled();
    } finally {
      autoSpy.mockRestore();
      legacySpy.mockRestore();
    }
  });

  it('auditoria do cutover: o turno registra o pipeline autônomo com correlationId', async () => {
    const { live, gateway } = harness();
    const eventSpy = vi.spyOn(live.observability, 'event');
    try {
      await live.conversation.receive(envelope('quero rever meu consignado', 'M1'));
      expect(gateway.texts().length).toBeGreaterThanOrEqual(1);
      const registrouAutonomo = eventSpy.mock.calls.some(
        (c) => c[0] === 'pipeline' && typeof c[1] === 'string' && c[1].startsWith('autonomous corr='),
      );
      expect(registrouAutonomo).toBe(true);
    } finally {
      eventSpy.mockRestore();
    }
  });

  it('ROLLBACK: pipeline="legacy" volta ao FullLoopBrainAdapter (autônomo NÃO participa)', async () => {
    const autoSpy = vi.spyOn(AutonomousBrainAdapter.prototype, 'decide');
    const legacySpy = vi.spyOn(FullLoopBrainAdapter.prototype, 'decide');
    try {
      const { live, gateway } = harness('legacy');

      expect(live.pipelineMode).toBe('legacy');
      await live.conversation.receive(envelope('olá, preciso de ajuda com meu consignado', 'M1'));

      expect(gateway.texts().length).toBeGreaterThanOrEqual(1);
      expect(legacySpy).toHaveBeenCalled();
      expect(autoSpy).not.toHaveBeenCalled();
    } finally {
      autoSpy.mockRestore();
      legacySpy.mockRestore();
    }
  });
});
