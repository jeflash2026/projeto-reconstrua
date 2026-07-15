// ─────────────────────────────────────────────────────────────────────────────
// CLIENT MEMORY — a MEMÓRIA VIVA de um cliente. NÃO é histórico de chat, NÃO é
// vetor, NÃO é banco de contexto: é o que um humano lembraria após acompanhar o
// cliente por meses. TUDO com RASTREABILIDADE (cada item tem `source`).
//
// A memória NUNCA cria Fato de domínio, NUNCA altera Verdade/Estado/Etapa, NUNCA
// decide. Ela só LEMBRA e FORNECE contexto.
// ─────────────────────────────────────────────────────────────────────────────

/** De onde veio um item de memória (rastreabilidade obrigatória). */
export interface MemorySource {
  readonly kind: 'conversation' | 'percept' | 'domain_event' | 'inferred';
  /** Referência concreta: messageId / perceptId / eventId. */
  readonly ref: string;
  readonly at: Date;
}

/** Um atributo lembrado (nome, apelido, profissão, cidade, familiar, preferência…). */
export interface MemoryAttribute {
  readonly key: string;
  readonly value: string;
  readonly source: MemorySource;
  readonly confidence: number; // 0..1
}

export interface RememberedEvent {
  readonly description: string;
  readonly source: MemorySource;
}

export interface EmotionObservation {
  readonly sentiment: string;
  readonly source: MemorySource;
}

export interface DocumentMemory {
  readonly ref: string;
  readonly label: string;
  readonly source: MemorySource;
}

export interface StageMemory {
  readonly stageRef: string;
  readonly source: MemorySource;
}

/** A memória completa e imutável de um cliente. */
export interface ClientMemory {
  readonly chatId: string;
  readonly attributes: readonly MemoryAttribute[];
  readonly rememberedEvents: readonly RememberedEvent[];
  readonly emotionsObserved: readonly EmotionObservation[];
  readonly documentsSent: readonly DocumentMemory[];
  readonly documentsPending: readonly string[];
  readonly stagesCompleted: readonly StageMemory[];
  /** Maneira de conversar (derivada) — ex.: 'objetivo', 'detalhista'. */
  readonly conversationStyle: string | null;
  /** Velocidade média de resposta do cliente (ms). */
  readonly avgResponseMs: number | null;
  /** Nº de amostras de tempo de resposta (para média incremental). */
  readonly responseSampleCount: number;
  /** Quando a AHRI falou por último (base para medir a resposta do cliente). */
  readonly lastOutboundAt: Date | null;
  readonly messageCount: number;
  readonly firstContactAt: Date | null;
  readonly lastContactAt: Date | null;
}

export function emptyMemory(chatId: string): ClientMemory {
  return {
    chatId,
    attributes: [],
    rememberedEvents: [],
    emotionsObserved: [],
    documentsSent: [],
    documentsPending: [],
    stagesCompleted: [],
    conversationStyle: null,
    avgResponseMs: null,
    responseSampleCount: 0,
    lastOutboundAt: null,
    messageCount: 0,
    firstContactAt: null,
    lastContactAt: null,
  };
}

/** Última observação de um atributo por chave (a memória evolui; mantém a mais recente). */
export function latestAttribute(memory: ClientMemory, key: string): MemoryAttribute | null {
  let latest: MemoryAttribute | null = null;
  for (const attr of memory.attributes) {
    if (attr.key !== key) continue;
    if (!latest || attr.source.at.getTime() >= latest.source.at.getTime()) latest = attr;
  }
  return latest;
}
