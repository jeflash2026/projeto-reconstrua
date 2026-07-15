// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP RUNTIME — preserva a CONTINUIDADE HUMANA. NÃO é CRM, NÃO vende, NÃO
// faz marketing. Responde, a partir da memória viva, perguntas de continuidade:
// "quando comecei?", "quais documentos você pediu?", "lembra do meu pai?", "como
// ficou minha perícia?". SEM decidir, SEM alterar domínio. Só lembra e contextualiza.
// ─────────────────────────────────────────────────────────────────────────────
import { latestAttribute, type RememberedEvent } from './client-memory.js';
import { normalizeForMatch } from './text-match.js';
import type { MemoryRuntime } from './memory-runtime.js';

export interface RelationshipContext {
  readonly chatId: string;
  readonly startedAt: Date | null;
  readonly pendingDocuments: readonly string[];
  readonly lastStageRef: string | null;
  readonly knownName: string | null;
  readonly rememberedTopics: readonly string[];
  /** Resumo de continuidade GERADO POR DADOS (não por LLM, não é decisão). */
  readonly summary: string;
}

export class RelationshipRuntime {
  constructor(private readonly memory: MemoryRuntime) {}

  async whenStarted(chatId: string): Promise<Date | null> {
    return (await this.memory.recall(chatId)).firstContactAt;
  }

  async pendingDocuments(chatId: string): Promise<readonly string[]> {
    return (await this.memory.recall(chatId)).documentsPending;
  }

  async currentStage(chatId: string): Promise<string | null> {
    const stages = (await this.memory.recall(chatId)).stagesCompleted;
    return stages.length > 0 ? (stages[stages.length - 1]?.stageRef ?? null) : null;
  }

  /** "Lembra que falei do meu pai?" — devolve os eventos lembrados que casam o termo. */
  async recallTopic(chatId: string, keyword: string): Promise<readonly RememberedEvent[]> {
    const needle = normalizeForMatch(keyword);
    if (needle === '') return [];
    const events = (await this.memory.recall(chatId)).rememberedEvents;
    return events.filter((e) => normalizeForMatch(e.description).includes(needle));
  }

  async context(chatId: string): Promise<RelationshipContext> {
    const memory = await this.memory.recall(chatId);
    const name = latestAttribute(memory, 'name')?.value ?? latestAttribute(memory, 'nickname')?.value ?? null;
    const lastStage = memory.stagesCompleted.at(-1)?.stageRef ?? null;
    const topics = memory.rememberedEvents.map((e) => e.description);

    const parts: string[] = [];
    if (name !== null) parts.push(`Cliente: ${name}.`);
    if (memory.firstContactAt !== null) parts.push(`Acompanhado desde ${memory.firstContactAt.toISOString().slice(0, 10)}.`);
    if (memory.documentsPending.length > 0) parts.push(`Documentos pendentes: ${memory.documentsPending.join(', ')}.`);
    if (memory.documentsSent.length > 0) parts.push(`Documentos recebidos: ${String(memory.documentsSent.length)}.`);
    if (lastStage !== null) parts.push(`Etapa atual: ${lastStage}.`);
    if (topics.length > 0) parts.push(`Assuntos lembrados: ${topics.join('; ')}.`);
    if (memory.conversationStyle !== null) parts.push(`Estilo: ${memory.conversationStyle}.`);

    return {
      chatId,
      startedAt: memory.firstContactAt,
      pendingDocuments: memory.documentsPending,
      lastStageRef: lastStage,
      knownName: name,
      rememberedTopics: topics,
      summary: parts.length > 0 ? parts.join(' ') : 'Sem histórico registrado ainda.',
    };
  }
}
