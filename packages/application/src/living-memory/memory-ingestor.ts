// ─────────────────────────────────────────────────────────────────────────────
// MEMORY INGESTOR — a tomada (aditiva) que alimenta a Memória Viva a partir de um
// turno: a mensagem do cliente, a emoção percebida, e os RESULTADOS do Mission
// Runtime (documentos reconhecidos, etapas representadas). Roda onde o chatId é
// conhecido — não é um subscriber de eventos de domínio (que não carregam chatId).
// Só LÊ resultados factuais e LEMBRA; nunca decide, nunca muta domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type { UseCaseOutcome } from '../mission-runtime/index.js';
import type { MemoryRuntime } from './memory-runtime.js';

export interface TurnObservation {
  readonly chatId: string;
  readonly messageId: string;
  readonly text: string | null;
  readonly perceptId: string;
  readonly sentiment: string;
  readonly at: Date;
}

export class MemoryIngestor {
  constructor(private readonly memory: MemoryRuntime) {}

  /** Ingere um turno: mensagem + emoção + texto (extração opcional) + resultados de missão. */
  async ingestTurn(observation: TurnObservation, outcomes: readonly UseCaseOutcome[]): Promise<void> {
    const { chatId, at } = observation;
    await this.memory.observeInbound(chatId, at);
    await this.memory.observeEmotion(chatId, observation.perceptId, observation.sentiment, at);
    if (observation.text !== null) {
      await this.memory.observeText(chatId, observation.messageId, observation.text, at);
    }
    for (const outcome of outcomes) {
      if (!outcome.ok || outcome.skipped || outcome.streamId === null) continue;
      if (outcome.useCase === 'RecognizeDocument') {
        await this.memory.observeDocumentSent(chatId, outcome.streamId, `documento ${outcome.streamId.slice(0, 8)}`, at);
      } else if (outcome.useCase === 'RepresentStage') {
        await this.memory.observeStageCompleted(chatId, outcome.streamId, outcome.streamId, at);
      }
    }
  }

  /** Registra que a AHRI respondeu (base para medir a velocidade de resposta do cliente). */
  async ingestOutbound(chatId: string, at: Date): Promise<void> {
    await this.memory.observeOutbound(chatId, at);
  }
}
