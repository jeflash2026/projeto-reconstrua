// ─────────────────────────────────────────────────────────────────────────────
// assembleLivingMemory — raiz de composição da Memória Viva + Relationship. Fia o
// MemoryRuntime (com extrator opcional), o ingestor (tomada do turno), o Relationship
// Runtime e, se houver ConversationStore (2B), o note-writer que injeta a memória no
// fraseado da Conversa. Um único lugar de montagem.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type {
  ConversationStore,
  MemoryAttributeExtractorPort,
  MemoryStore,
} from '@reconstrua/application';
import {
  MemoryIngestor,
  MemoryNoteWriter,
  MemoryRuntime,
  RelationshipRuntime,
} from '@reconstrua/application';
import { InMemoryMemoryStore } from './in-memory-memory-store.js';
import { PatternAttributeExtractor } from './fake-attribute-extractor.js';

export interface LivingMemoryWiring {
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly memoryStore?: MemoryStore;
  readonly extractor?: MemoryAttributeExtractorPort;
  readonly conversationStore?: ConversationStore;
}

export interface AssembledLivingMemory {
  readonly memory: MemoryRuntime;
  readonly ingestor: MemoryIngestor;
  readonly relationship: RelationshipRuntime;
  readonly memoryStore: MemoryStore;
  readonly noteWriter: MemoryNoteWriter | null;
}

export function assembleLivingMemory(wiring: LivingMemoryWiring): AssembledLivingMemory {
  const memoryStore = wiring.memoryStore ?? new InMemoryMemoryStore();
  const extractor = wiring.extractor ?? new PatternAttributeExtractor();
  const memory = new MemoryRuntime(memoryStore, extractor);
  const ingestor = new MemoryIngestor(memory);
  const relationship = new RelationshipRuntime(memory);
  const noteWriter = wiring.conversationStore
    ? new MemoryNoteWriter(wiring.conversationStore, relationship, wiring.clock, wiring.uuid)
    : null;
  return { memory, ingestor, relationship, memoryStore, noteWriter };
}
