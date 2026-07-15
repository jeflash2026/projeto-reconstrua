// ─────────────────────────────────────────────────────────────────────────────
// Tipos do Event Store (camada Application, agnóstica de tecnologia).
//
// O Event Store é a MEMÓRIA OFICIAL do AHRIOS: append-only, perpétua (Lei 3;
// DF-11; Art. 14º). Cada evento é um fato imutável, versionado por stream, com
// rastreabilidade constitucional (DF-09; DF-13; E12-L09) e encadeamento verificável
// (R9). Estes tipos descrevem o que é anexado e o que fica persistido; a mecânica
// de gravação vive nos adapters (infra).
// ─────────────────────────────────────────────────────────────────────────────

/** Tipo do stream (raiz de consistência): ex. 'mission', 'person'. */
export type StreamType = string;
/** Identidade do stream (Uuid como string opaca). */
export type StreamId = string;

/**
 * Expectativa de versão para CONCORRÊNCIA OTIMISTA. A escrita só é aceita se o
 * estado do stream corresponder ao esperado; caso contrário, conflito.
 */
export type ExpectedVersion =
  | { readonly kind: 'no-stream' } // o stream não pode existir (primeiro evento → versão 1)
  | { readonly kind: 'exact'; readonly version: number } // a última versão deve ser exatamente esta
  | { readonly kind: 'any' }; // anexa independentemente da versão atual

export const NO_STREAM: ExpectedVersion = { kind: 'no-stream' };
export const ANY_VERSION: ExpectedVersion = { kind: 'any' };
export function atVersion(version: number): ExpectedVersion {
  return { kind: 'exact', version };
}

/**
 * Proveniência constitucional de um evento (Art. 14º; DF-09; DF-13; E12-L09).
 * Campos opcionais no ato de anexar; normalizados para `string | null` ao persistir.
 */
export interface EventProvenance {
  /** Fato reconhecido que fundamenta um Evento Relevante (E12-L09; obrigatório se isRelevant). */
  readonly factRef?: string;
  /** DECISOR — quem atuou (humano ou AHRI) (Art. 14º; DF-09). */
  readonly actor?: string;
  /** TIPO da decisão (ex.: "Decisão Operacional Automatizada") (DF-09). */
  readonly decisionType?: string;
  /** FUNDAMENTO (Regra Constitucional + Regra Operacional) (DF-09). */
  readonly fundamento?: string;
  /** Regra Operacional referenciada (DF-13). */
  readonly operationalRuleRef?: string;
}

/** Proveniência já normalizada (persistida): ausência = null. */
export interface StoredProvenance {
  readonly factRef: string | null;
  readonly actor: string | null;
  readonly decisionType: string | null;
  readonly fundamento: string | null;
  readonly operationalRuleRef: string | null;
}

/** Evento a ser anexado (ainda não persistido, sem versão/hash). */
export interface UncommittedEvent {
  /** Nome estável do tipo de evento (o `eventName` do evento de domínio). */
  readonly eventType: string;
  /** Evento Relevante (altera estado) × Informativo (DF-05; DF-14). */
  readonly isRelevant: boolean;
  /** Conteúdo do evento. */
  readonly payload: Readonly<Record<string, unknown>>;
  /** Momento em que o fato ocorreu na Realidade. */
  readonly occurredAt: Date;
  /** Proveniência constitucional (opcional). */
  readonly provenance?: EventProvenance;
}

/** Evento persistido (imutável, versionado, encadeado). */
export interface StoredEvent {
  readonly id: string;
  readonly streamType: StreamType;
  readonly streamId: StreamId;
  readonly version: number; // >= 1, sequencial e único por stream
  readonly eventType: string;
  readonly isRelevant: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly provenance: StoredProvenance;
  readonly previousHash: string | null; // hash do evento anterior do stream (null na versão 1)
  readonly hash: string; // encadeamento verificável (R9)
  readonly occurredAt: Date;
  readonly recordedAt: Date; // quando o Sistema reconheceu
  readonly globalSeq: number; // sequência global monotônica (leitura ordenada / projeções)
}

/** Resultado de um append bem-sucedido. */
export interface AppendResult {
  readonly events: readonly StoredEvent[];
  readonly version: number; // nova versão do stream após o append
}

/** Normaliza uma proveniência opcional para a forma persistida. */
export function normalizeProvenance(p: EventProvenance | undefined): StoredProvenance {
  return {
    factRef: p?.factRef ?? null,
    actor: p?.actor ?? null,
    decisionType: p?.decisionType ?? null,
    fundamento: p?.fundamento ?? null,
    operationalRuleRef: p?.operationalRuleRef ?? null,
  };
}
