// ─────────────────────────────────────────────────────────────────────────────
// PORTS do Runtime de Conversa (Application). INTERFACES — os adapters concretos
// (Evolution, LLM, in-memory/pg) vivem na infraestrutura. Nenhum port importa
// tecnologia.
//
// FRONTEIRA CONSTITUCIONAL (spec 2B; ADR-0002A §3):
//  • O LLM vive em DOIS ports e SÓ: `LlmPerceptionPort` (entende) e
//    `LlmExpressionPort` (frasea). Ambos devolvem DADO/TEXTO — jamais decisão.
//  • Toda decisão vem do `ExecutiveBrainPort` (Camada 2, determinístico, alhures).
//    A Conversa CONSOME intenções; nunca as cria.
//  • A Conversa NÃO possui port de escrita de domínio (sem EventStore/Repository/
//    UnitOfWork). Por CONSTRUÇÃO ela não pode alterar Verdade/Estado/Etapa, criar
//    Documento nem criar Evento de domínio. Sua "memória" é um log de INTEGRAÇÃO
//    (ADR-0002A §6: eventos de runtime, não de domínio).
// ─────────────────────────────────────────────────────────────────────────────
import type { InboundEnvelope, Percept, PerceptEnrichment } from './percept.js';
import type { ConversationIntent } from './intent.js';

// ── LLM sandbox: PERCEPÇÃO (entende) ─────────────────────────────────────────
export interface PerceptionContext {
  readonly recentSummary: string | null;
}
export interface LlmPerceptionPort {
  understand(envelope: InboundEnvelope, context: PerceptionContext): Promise<PerceptEnrichment>;
}

// ── LLM sandbox: EXPRESSÃO (frasea) ──────────────────────────────────────────
export interface PhrasingRequest {
  readonly intent: ConversationIntent;
  readonly context: ConversationContextView;
  /** Frases recentes da AHRI a EVITAR (anti-repetição). */
  readonly avoidPhrases: readonly string[];
  /** Diretriz de estilo (sem template): tom/registro derivado do contexto. */
  readonly styleGuidance: string;
}
export interface LlmExpressionPort {
  /** Devolve TEXTO natural. Nunca decide, nunca inventa fato/regra. */
  phrase(request: PhrasingRequest): Promise<string>;
}

// ── EXECUTIVE BRAIN: a única fonte de decisão (Camada 2) ──────────────────────
export interface BrainInput {
  readonly percept: Percept;
  readonly context: ConversationContextView;
}
export interface ExecutiveBrainPort {
  /** Decide 0..N intenções a partir do Percept + contexto. Determinístico. */
  decide(input: BrainInput): Promise<readonly ConversationIntent[]>;
}

// ── GATEWAY de saída (Evolution/WhatsApp) ─────────────────────────────────────
export type PresenceState = 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';
export interface OutboundReceipt {
  readonly providerMessageId: string;
  readonly sentAt: Date;
}
export interface ConversationGateway {
  sendText(chatId: string, text: string): Promise<OutboundReceipt>;
  setPresence(chatId: string, state: PresenceState): Promise<void>;
  sendReaction(chatId: string, messageId: string, emoji: string): Promise<void>;
  markRead(chatId: string, messageId: string): Promise<void>;
}

// ── MEMÓRIA de conversa (log de INTEGRAÇÃO — não é o Event Store de domínio) ───
export type MemoryEntryKind = 'inbound' | 'percept' | 'intent' | 'outbound' | 'note';
export interface MemoryEntry {
  readonly id: string;
  readonly chatId: string;
  readonly kind: MemoryEntryKind;
  readonly at: Date;
  readonly text: string | null;
  /** Diretiva da intenção (quando kind='intent'). */
  readonly intentDirective: string | null;
  /** Proveniência da intenção registrada (INV-AH-02). */
  readonly operationalRuleRef: string | null;
  /** Metadados livres (ex.: messageId do provedor, para idempotência). */
  readonly meta: Readonly<Record<string, string>>;
}
export interface ConversationStore {
  append(entry: MemoryEntry): Promise<void>;
  recent(chatId: string, limit: number): Promise<readonly MemoryEntry[]>;
  recentOutboundTexts(chatId: string, limit: number): Promise<readonly string[]>;
  lastInboundAt(chatId: string): Promise<Date | null>;
  /** Idempotência: já registramos este messageId do provedor? */
  hasInbound(chatId: string, providerMessageId: string): Promise<boolean>;
}

// ── SESSÃO ────────────────────────────────────────────────────────────────────
export type SessionStatus = 'active' | 'paused' | 'closed';
export interface Session {
  readonly chatId: string;
  readonly openedAt: Date;
  readonly lastInboundAt: Date | null;
  readonly lastOutboundAt: Date | null;
  readonly turns: number;
  readonly presence: PresenceState;
  readonly awaitingDocuments: boolean;
  readonly status: SessionStatus;
  /** Marca de silêncio já percebida, para não re-perceber o mesmo silêncio. */
  readonly lastSilenceNoticeAt: Date | null;
}
export interface SessionStore {
  getOrOpen(chatId: string, now: Date): Promise<Session>;
  save(session: Session): Promise<void>;
  all(): Promise<readonly Session[]>;
}

// ── FILA de mensagens (saída ordenada por conversa) ───────────────────────────
export type QueuedStatus = 'pending' | 'sent';
export interface QueuedMessage {
  readonly id: string;
  readonly chatId: string;
  readonly seq: number;
  readonly intentId: string;
  readonly text: string;
  readonly enqueuedAt: Date;
  readonly status: QueuedStatus;
}
export interface EnqueueInput {
  readonly id: string;
  readonly chatId: string;
  readonly intentId: string;
  readonly text: string;
  readonly enqueuedAt: Date;
}
export interface MessageQueueStore {
  /** Enfileira; o store atribui `seq` monotônico por chatId (ordem de inserção). */
  enqueue(input: EnqueueInput): Promise<QueuedMessage>;
  /** A pendente de MENOR seq (FIFO por conversa). */
  nextPending(chatId: string): Promise<QueuedMessage | null>;
  markSent(id: string): Promise<void>;
  pendingCount(chatId: string): Promise<number>;
}

// ── DELAY: primitiva de espera injetável (real em prod, virtual em teste) ──────
export interface Sleeper {
  sleep(ms: number): Promise<void>;
}

// ── CONTEXTO montado (lido pela expressão e — conceitualmente — pelo Brain) ────
export interface ConversationContextView {
  readonly chatId: string;
  readonly session: Session;
  readonly recentEntries: readonly MemoryEntry[];
  readonly recentOutboundTexts: readonly string[];
  readonly lastPercept: Percept | null;
  readonly silenceMs: number | null;
}
