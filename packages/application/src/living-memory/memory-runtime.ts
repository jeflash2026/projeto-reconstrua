// ─────────────────────────────────────────────────────────────────────────────
// MEMORY RUNTIME — constrói e serve a MEMÓRIA VIVA. Observa o fluxo (mensagens,
// percepções, eventos de domínio projetados) e ACUMULA memória com rastreabilidade.
// DETERMINÍSTICO no núcleo; um extrator opcional (percepção) PROPÕE atributos.
//
// NUNCA cria Fato de domínio, NUNCA altera Verdade/Estado/Etapa, NUNCA decide.
// Só lembra e fornece contexto (via `recall`).
// ─────────────────────────────────────────────────────────────────────────────
import {
  emptyMemory,
  type ClientMemory,
  type DocumentMemory,
  type EmotionObservation,
  type MemoryAttribute,
  type MemorySource,
  type RememberedEvent,
  type StageMemory,
} from './client-memory.js';
import type { MemoryAttributeExtractorPort, MemoryStore } from './ports.js';

function styleFor(avgResponseMs: number | null, messageCount: number): string | null {
  if (messageCount === 0) return null;
  if (avgResponseMs !== null && avgResponseMs < 30_000) return 'ágil e direto';
  if (avgResponseMs !== null && avgResponseMs > 10 * 60_000)
    return 'reflexivo, responde quando pode';
  return 'atento';
}

export class MemoryRuntime {
  constructor(
    private readonly store: MemoryStore,
    private readonly extractor?: MemoryAttributeExtractorPort,
  ) {}

  private async load(chatId: string): Promise<ClientMemory> {
    return (await this.store.load(chatId)) ?? emptyMemory(chatId);
  }

  /** Chegada de mensagem do cliente: conta, data e (se houver saída anterior) mede a resposta. */
  async observeInbound(chatId: string, at: Date): Promise<void> {
    const memory = await this.load(chatId);
    let avg = memory.avgResponseMs;
    let samples = memory.responseSampleCount;
    if (memory.lastOutboundAt !== null) {
      const delta = at.getTime() - memory.lastOutboundAt.getTime();
      if (delta >= 0) {
        const prevTotal = (avg ?? 0) * samples;
        samples += 1;
        avg = (prevTotal + delta) / samples;
      }
    }
    await this.store.save({
      ...memory,
      messageCount: memory.messageCount + 1,
      firstContactAt: memory.firstContactAt ?? at,
      lastContactAt: at,
      avgResponseMs: avg,
      responseSampleCount: samples,
      conversationStyle: styleFor(avg, memory.messageCount + 1),
    });
  }

  /** A AHRI falou: marca o instante (base para medir a próxima resposta do cliente). */
  async observeOutbound(chatId: string, at: Date): Promise<void> {
    const memory = await this.load(chatId);
    await this.store.save({ ...memory, lastOutboundAt: at });
  }

  /** Emoção percebida (do enriquecimento do percept). Com fonte. */
  async observeEmotion(
    chatId: string,
    perceptId: string,
    sentiment: string,
    at: Date,
  ): Promise<void> {
    if (sentiment === 'neutral' || sentiment === 'unknown') return;
    const memory = await this.load(chatId);
    const observation: EmotionObservation = {
      sentiment,
      source: { kind: 'percept', ref: perceptId, at },
    };
    await this.store.save({
      ...memory,
      emotionsObserved: [...memory.emotionsObserved, observation],
    });
  }

  /** Texto do cliente: o extrator (opcional) PROPÕE atributos (nome/profissão/cidade…). */
  async observeText(chatId: string, messageId: string, text: string, at: Date): Promise<void> {
    if (!this.extractor || text.trim() === '') return;
    const proposed = await this.extractor.extract(text);
    if (proposed.length === 0) return;
    const memory = await this.load(chatId);
    const source: MemorySource = { kind: 'conversation', ref: messageId, at };
    const attributes: MemoryAttribute[] = proposed.map((p) => ({
      key: p.key,
      value: p.value,
      confidence: p.confidence,
      source,
    }));
    await this.store.save({ ...memory, attributes: [...memory.attributes, ...attributes] });
  }

  /** Algo importante mencionado (ex.: "falei do meu pai"). Com fonte. */
  async rememberEvent(chatId: string, ref: string, description: string, at: Date): Promise<void> {
    const memory = await this.load(chatId);
    const event: RememberedEvent = { description, source: { kind: 'conversation', ref, at } };
    await this.store.save({ ...memory, rememberedEvents: [...memory.rememberedEvents, event] });
  }

  /** Documento reconhecido (evento de domínio projetado). Factual, com fonte. */
  async observeDocumentSent(
    chatId: string,
    eventId: string,
    label: string,
    at: Date,
  ): Promise<void> {
    const memory = await this.load(chatId);
    const doc: DocumentMemory = {
      ref: eventId,
      label,
      source: { kind: 'domain_event', ref: eventId, at },
    };
    const pending = memory.documentsPending.filter((p) => p !== label);
    await this.store.save({
      ...memory,
      documentsSent: [...memory.documentsSent, doc],
      documentsPending: pending,
    });
  }

  /** Documentos que a AHRI pediu e ainda aguarda. */
  async setPendingDocuments(chatId: string, labels: readonly string[]): Promise<void> {
    const memory = await this.load(chatId);
    await this.store.save({ ...memory, documentsPending: [...labels] });
  }

  /** Etapa concluída (evento de domínio projetado). Com fonte. */
  async observeStageCompleted(
    chatId: string,
    eventId: string,
    stageRef: string,
    at: Date,
  ): Promise<void> {
    const memory = await this.load(chatId);
    const stage: StageMemory = { stageRef, source: { kind: 'domain_event', ref: eventId, at } };
    await this.store.save({ ...memory, stagesCompleted: [...memory.stagesCompleted, stage] });
  }

  /** Devolve a memória atual (contexto). Nunca decide; só lembra. */
  async recall(chatId: string): Promise<ClientMemory> {
    return this.load(chatId);
  }
}
