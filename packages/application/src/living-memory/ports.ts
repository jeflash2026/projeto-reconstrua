// ─────────────────────────────────────────────────────────────────────────────
// PORTS da Memória Viva. A memória LÊ do fluxo (conversa/percepção/eventos) e
// PERSISTE seu próprio acumulado. Não escreve domínio, não lê o Event Store por
// interface (recebe eventos projetados). Um extrator OPCIONAL (percepção por LLM)
// PROPÕE atributos — nunca decide, sempre com fonte.
// ─────────────────────────────────────────────────────────────────────────────
import type { ClientMemory } from './client-memory.js';

/** Persistência da memória viva (in-memory / pg). */
export interface MemoryStore {
  load(chatId: string): Promise<ClientMemory | null>;
  save(memory: ClientMemory): Promise<void>;
  all(): Promise<readonly ClientMemory[]>;
}

/** Atributo PROPOSTO por percepção (nunca decisão; sempre com origem no texto). */
export interface ProposedAttribute {
  readonly key: string;
  readonly value: string;
  readonly confidence: number;
}

/** Extrator de atributos (percepção por LLM — ENTENDE, não decide). Opcional. */
export interface MemoryAttributeExtractorPort {
  extract(text: string): Promise<readonly ProposedAttribute[]>;
}
